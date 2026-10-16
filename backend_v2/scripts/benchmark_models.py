"""
Comprehensive Model Benchmark and Smoke Test Script for Milestone B.
Evaluates:
  1. InsightFace: buffalo_s vs buffalo_l (detection, alignment, ArcFace 512-D embedding)
  2. MiniFASNetV2 ONNX: Face Anti-Spoofing / Presentation Attack Detection
Runs on Windows CPU using ONNX Runtime.
"""

import os
import sys
import time
import json
import tracemalloc
import cv2
import numpy as np
import onnxruntime as ort
import insightface
from insightface.app import FaceAnalysis

def softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x, axis=1, keepdims=True))
    return e_x / e_x.sum(axis=1, keepdims=True)

def crop_face(image: np.ndarray, bbox: list[float] | np.ndarray, scale: float = 2.7) -> np.ndarray:
    src_h, src_w = image.shape[:2]
    x1, y1, x2, y2 = bbox[:4]
    box_w = x2 - x1
    box_h = y2 - y1

    s = min((src_h - 1) / box_h, (src_w - 1) / box_w, scale)
    new_w = box_w * s
    new_h = box_h * s

    center_x = x1 + box_w / 2
    center_y = y1 + box_h / 2

    nx1 = max(0, int(center_x - new_w / 2))
    ny1 = max(0, int(center_y - new_h / 2))
    nx2 = min(src_w - 1, int(center_x + new_w / 2))
    ny2 = min(src_h - 1, int(center_y + new_h / 2))

    cropped = image[ny1 : ny2 + 1, nx1 : nx2 + 1]
    return cv2.resize(cropped, (80, 80))

def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(emb1, emb2) / (norm1 * norm2))

def evaluate_insightface_variant(variant_name: str, test_images: list[str]):
    print(f"\n==========================================")
    print(f"Evaluating InsightFace: {variant_name}")
    print(f"==========================================")
    
    tracemalloc.start()
    t0 = time.perf_counter()
    app = FaceAnalysis(name=variant_name, providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    init_time = time.perf_counter() - t0
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    print(f"Initialization Time: {init_time:.3f} s")
    print(f"Peak Memory Allocated: {peak_mem / (1024 * 1024):.2f} MB")
    
    results = {
        "variant": variant_name,
        "init_time_sec": round(init_time, 4),
        "peak_mem_mb": round(peak_mem / (1024 * 1024), 2),
        "images": []
    }
    
    embeddings = {}
    for img_path in test_images:
        img_name = os.path.basename(img_path)
        img = cv2.imread(img_path)
        if img is None:
            print(f"Error loading {img_path}")
            continue
        
        # Warmup and timing
        latencies = []
        for _ in range(5):
            t_start = time.perf_counter()
            faces = app.get(img)
            latencies.append((time.perf_counter() - t_start) * 1000)
            
        avg_latency = float(np.mean(latencies))
        face_count = len(faces)
        print(f"Image: {img_name} | Detected Faces: {face_count} | Avg Latency: {avg_latency:.2f} ms")
        
        img_info = {
            "image": img_name,
            "face_count": face_count,
            "avg_latency_ms": round(avg_latency, 2)
        }
        
        if face_count > 0:
            face = faces[0]
            emb = face.embedding
            emb_norm = float(np.linalg.norm(emb))
            embeddings[img_name] = emb
            img_info["embedding_dim"] = int(emb.shape[0])
            img_info["embedding_norm"] = round(emb_norm, 4)
            img_info["bbox"] = [round(float(c), 1) for c in face.bbox]
            print(f"  Embedding Dim: {emb.shape[0]}, L2 Norm: {emb_norm:.4f}, Det Score: {float(face.det_score):.4f}")
        
        results["images"].append(img_info)
        
    # Pairwise cosine comparisons
    keys = list(embeddings.keys())
    print("\nPairwise Cosine Similarities:")
    pairs = {}
    for i in range(len(keys)):
        for j in range(i, len(keys)):
            sim = cosine_similarity(embeddings[keys[i]], embeddings[keys[j]])
            pair_key = f"{keys[i]} vs {keys[j]}"
            pairs[pair_key] = round(sim, 4)
            print(f"  {pair_key}: {sim:.4f}")
    results["similarities"] = pairs
    return results

def evaluate_minifasnet(model_path: str, test_images: list[str]):
    print(f"\n==========================================")
    print(f"Evaluating MiniFASNetV2: {model_path}")
    print(f"==========================================")
    
    tracemalloc.start()
    t0 = time.perf_counter()
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    init_time = time.perf_counter() - t0
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    input_cfg = session.get_inputs()[0]
    output_cfg = session.get_outputs()[0]
    
    print(f"Initialization Time: {init_time:.4f} s")
    print(f"Peak Memory Allocated: {peak_mem / (1024 * 1024):.2f} MB")
    print(f"Input: name={input_cfg.name}, shape={input_cfg.shape}, type={input_cfg.type}")
    print(f"Output: name={output_cfg.name}, shape={output_cfg.shape}, type={output_cfg.type}")
    
    # Use InsightFace buffalo_s detector for face cropping
    detector = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
    detector.prepare(ctx_id=0, det_size=(640, 640))
    
    results = {
        "model_path": model_path,
        "init_time_sec": round(init_time, 4),
        "peak_mem_mb": round(peak_mem / (1024 * 1024), 2),
        "evaluations": []
    }
    
    for img_path in test_images:
        img_name = os.path.basename(img_path)
        img = cv2.imread(img_path)
        faces = detector.get(img)
        if not faces:
            print(f"No face detected in {img_name}")
            continue
        
        face = faces[0]
        crop = crop_face(img, face.bbox, scale=2.7)
        blob = crop.astype(np.float32).transpose(2, 0, 1)[np.newaxis, :]
        
        # Benchmark inference latency
        latencies = []
        for _ in range(10):
            t_start = time.perf_counter()
            out = session.run([output_cfg.name], {input_cfg.name: blob})[0]
            latencies.append((time.perf_counter() - t_start) * 1000)
            
        avg_latency = float(np.mean(latencies))
        probs = softmax(out)
        idx = int(np.argmax(probs))
        real_prob = float(probs[0, 1])
        label = "Real" if idx == 1 else "Fake"
        
        eval_item = {
            "image": img_name,
            "ground_truth": "Real" if "T" in img_name else "Fake",
            "predicted_label": label,
            "predicted_class_index": idx,
            "real_probability": round(real_prob, 4),
            "class_probabilities": [round(float(p), 4) for p in probs[0]],
            "avg_latency_ms": round(avg_latency, 2)
        }
        results["evaluations"].append(eval_item)
        print(f"Image: {img_name:<14} | GT: {eval_item['ground_truth']:<4} | Pred: {label:<4} (class {idx}) | Real Prob: {real_prob:.4f} | Latency: {avg_latency:.2f} ms")
        
    return results

def main():
    assets_dir = "face-anti-spoofing/assets"
    test_images = [
        os.path.join(assets_dir, "image_T1.jpg"),
        os.path.join(assets_dir, "image_F1.jpg"),
        os.path.join(assets_dir, "image_F2.jpg"),
    ]
    
    bf_s_res = evaluate_insightface_variant("buffalo_s", test_images)
    bf_l_res = evaluate_insightface_variant("buffalo_l", test_images)
    fas_res = evaluate_minifasnet("backend_v2/models/MiniFASNetV2.onnx", test_images)
    
    summary = {
        "buffalo_s": bf_s_res,
        "buffalo_l": bf_l_res,
        "minifasnet_v2": fas_res
    }
    
    os.makedirs("backend_v2/reports", exist_ok=True)
    report_file = "backend_v2/reports/benchmark_results.json"
    with open(report_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nAll benchmark results saved to {report_file}")

if __name__ == "__main__":
    main()
