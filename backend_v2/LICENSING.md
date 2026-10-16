# Model & Software Licensing Compliance Report

This document records the licensing terms, permissions, and operational constraints for all software packages and deep learning models integrated into `backend_v2`.

---

## 1. InsightFace Library & Pretrained Weights

### 1.1 Python Package & Source Code
- **Repository**: [https://github.com/deepinsight/insightface](https://github.com/deepinsight/insightface)
- **License**: **MIT License**
- **Commercial Usage**: Permitted for software code.

### 1.2 Pretrained Model Weights (`buffalo_s` and `buffalo_l`)
- **Origin**: DeepInsight InsightFace Model Zoo (`buffalo_s.zip`, `buffalo_l.zip`).
- **Models Included**:
  - `det_500m.onnx` / `det_10g.onnx` (SCRFD Face Detectors)
  - `w600k_mbf.onnx` / `w600k_r50.onnx` (MobileFaceNet / ResNet-50 ArcFace recognizers)
- **License Policy**:
  > *"The training data containing the annotation (and the models trained with these data) are available for **non-commercial research purposes only**. Both manual-downloading models from our github repo and auto-downloading models with our python-library follow the above license policy (which is for non-commercial research purposes only)."*
- **Application Scope**:
  - **Permitted**: College capstone projects, academic evaluation, faculty demonstrations, classroom trials, and non-commercial educational institution testing.
  - **Restricted**: Commercial deployment or sale requires a commercial license from DeepInsight (`recognition-oss-pack@insightface.ai`).

---

## 2. Silent Face Anti-Spoofing (MiniFASNetV2)

### 2.1 Code & ONNX Checkpoint
- **Repository**: [https://github.com/yakhyo/face-anti-spoofing](https://github.com/yakhyo/face-anti-spoofing)
- **Upstream Reference**: [Minivision Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing)
- **License**: **Apache License 2.0**
- **Architecture**: Lightweight depthwise separable convolutional neural network with ConvBNPReLU and Squeeze-and-Excitation (SE) channel attention modules (~0.43M parameters).
- **Application Scope**:
  - Apache 2.0 allows free academic, research, and non-commercial/commercial distribution, provided attribution and copyright notices are maintained.

---

## 3. Biometric Data Privacy & Consensual Compliance

In accordance with institutional biometric protection and data retention standards:
1. **Raw Photo Privacy**: Full-resolution student camera photographs are processed entirely in memory (RAM) and are **never** stored on disk.
2. **Template Protection**: Only 512-dimensional $L_2$-normalized mathematical floating-point vectors are persisted in the `biometrics` table. These vectors cannot be reverse-engineered into high-resolution facial imagery.
3. **Right to Deletion**: The system provides an explicit `POST /api/students/delete-face` endpoint which completely wipes the biometric embedding from the database upon student request.
4. **Alternative Workflow**: If a student does not provide biometric consent, faculty can utilize the manual override endpoint (`POST /api/attendance/override`) with an audit reason to mark attendance without biometric capture.
