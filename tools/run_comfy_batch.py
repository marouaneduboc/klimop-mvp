#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


def http_json(url: str, payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    if payload is None:
        req = Request(url, method="GET")
    else:
        body = json.dumps(payload).encode("utf-8")
        req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=timeout) as resp:  # nosec B310 (local ComfyUI endpoint)
        return json.loads(resp.read().decode("utf-8"))


def http_bytes(url: str, timeout: int = 60) -> bytes:
    req = Request(url, method="GET")
    with urlopen(req, timeout=timeout) as resp:  # nosec B310 (local ComfyUI endpoint)
        return resp.read()


def first_output_image(history_item: dict[str, Any]) -> dict[str, str] | None:
    outputs = history_item.get("outputs", {})
    if not isinstance(outputs, dict):
        return None
    for node_data in outputs.values():
        if not isinstance(node_data, dict):
            continue
        images = node_data.get("images", [])
        if not isinstance(images, list):
            continue
        for img in images:
            if not isinstance(img, dict):
                continue
            if "filename" in img and "type" in img:
                return {
                    "filename": str(img["filename"]),
                    "subfolder": str(img.get("subfolder", "")),
                    "type": str(img.get("type", "output")),
                }
    return None


def queue_and_wait(comfy_url: str, workflow: dict[str, Any], timeout_sec: int) -> dict[str, str]:
    client_id = str(uuid.uuid4())
    queued = http_json(urljoin(comfy_url, "/prompt"), {"prompt": workflow, "client_id": client_id})
    prompt_id = queued.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"No prompt_id in response: {queued}")

    history_url = urljoin(comfy_url, f"/history/{prompt_id}")
    start = time.time()
    while True:
        hist = http_json(history_url)
        item = hist.get(prompt_id)
        if item:
            out = first_output_image(item)
            if out:
                return out
            status = item.get("status", {})
            if isinstance(status, dict) and status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI generation failed: {status}")
        if time.time() - start > timeout_sec:
            raise TimeoutError(f"Timed out waiting for prompt {prompt_id}")
        time.sleep(1.0)


def main() -> None:
    ap = argparse.ArgumentParser(description="Batch-generate images in ComfyUI from exported flashcard jobs.")
    ap.add_argument("--jobs", required=True, help="Path to flashcard_image_jobs.json")
    ap.add_argument("--workflow", required=True, help="Path to ComfyUI API workflow JSON")
    ap.add_argument("--comfy-url", default="http://127.0.0.1:8188", help="ComfyUI base URL")
    ap.add_argument("--out-dir", required=True, help="Where to save generated images")
    ap.add_argument("--prompt-node", default="45", help="CLIPTextEncode node id for positive prompt")
    ap.add_argument("--negative-node", default="57", help="CLIPTextEncode node id for negative prompt")
    ap.add_argument("--size-node", default="41", help="Node id that has width/height inputs")
    ap.add_argument("--save-node", default="9", help="SaveImage node id (filename_prefix)")
    ap.add_argument("--ksampler-node", default="44", help="KSampler node id for seed override")
    ap.add_argument("--seed-mode", choices=["hash", "fixed", "workflow"], default="hash", help="How to set seed per job")
    ap.add_argument("--seed", type=int, default=123456789, help="Base seed when --seed-mode=fixed")
    ap.add_argument("--limit", type=int, default=0, help="Process first N jobs only (0 = all)")
    ap.add_argument("--timeout-sec", type=int, default=180, help="Max wait per image")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing output files")
    args = ap.parse_args()

    jobs_path = Path(args.jobs).expanduser().resolve()
    workflow_path = Path(args.workflow).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs_payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    jobs = list(jobs_payload.get("jobs", []))
    if not jobs:
        raise RuntimeError("No jobs found in jobs JSON.")

    workflow_template = json.loads(workflow_path.read_text(encoding="utf-8"))
    for node_id in (args.prompt_node, args.negative_node, args.size_node, args.save_node):
        if node_id and node_id not in workflow_template:
            raise RuntimeError(f"Node {node_id} not found in workflow.")
    if args.seed_mode in {"hash", "fixed"} and args.ksampler_node not in workflow_template:
        raise RuntimeError(f"KSampler node {args.ksampler_node} not found in workflow.")

    done = 0
    skipped = 0
    failed = 0
    selected = jobs[: args.limit] if args.limit and args.limit > 0 else jobs

    for i, job in enumerate(selected, start=1):
        card_id = str(job.get("id", f"row_{i:04d}"))
        output_filename = str(job.get("output_filename") or f"{card_id}.png")
        target = out_dir / output_filename

        if target.exists() and not args.overwrite:
            skipped += 1
            print(f"[skip] {output_filename} already exists")
            continue

        prompt = str(job.get("prompt", "")).strip()
        negative_prompt = str(job.get("negative_prompt", "")).strip()
        width = int(job.get("width", 512))
        height = int(job.get("height", 512))

        wf = copy.deepcopy(workflow_template)
        wf[args.prompt_node]["inputs"]["text"] = prompt
        if args.negative_node:
            wf[args.negative_node]["inputs"]["text"] = negative_prompt
        if args.size_node:
            wf[args.size_node]["inputs"]["width"] = width
            wf[args.size_node]["inputs"]["height"] = height
        if args.save_node:
            wf[args.save_node]["inputs"]["filename_prefix"] = f"flashcards/{card_id}"
        if args.seed_mode == "hash":
            h = hashlib.sha1(card_id.encode("utf-8")).hexdigest()
            wf[args.ksampler_node]["inputs"]["seed"] = int(h[:15], 16)
        elif args.seed_mode == "fixed":
            wf[args.ksampler_node]["inputs"]["seed"] = int(args.seed) + i

        try:
            img_meta = queue_and_wait(args.comfy_url, wf, timeout_sec=args.timeout_sec)
            query = urlencode(
                {
                    "filename": img_meta["filename"],
                    "subfolder": img_meta["subfolder"],
                    "type": img_meta["type"],
                }
            )
            blob = http_bytes(urljoin(args.comfy_url, f"/view?{query}"), timeout=60)
            target.write_bytes(blob)
            done += 1
            print(f"[ok {done}/{len(selected)}] {card_id} -> {target.name}")
        except Exception as e:
            failed += 1
            print(f"[fail] {card_id}: {e}")

    print(f"Done. ok={done} skipped={skipped} failed={failed} total={len(selected)} out={out_dir}")


if __name__ == "__main__":
    main()
