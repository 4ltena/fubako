# 顔判定の配布資産

YuNetは[OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)の`face_detection_yunet_2023mar.onnx`を使用する。2026-09-11に[モデル実体](https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx)を取得し、232589バイトとSHA-256 `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`を照合した。MITライセンスは同じディレクトリーに保持する。

ONNX Runtime Webはnpmの`onnxruntime-web@1.29.0`を固定し、lockfileのintegrityで配布物を照合する。npm配布物にはライセンス本文が含まれていなかったため、公式リポジトリーの[v1.29.0 LICENSE](https://raw.githubusercontent.com/microsoft/onnxruntime/v1.29.0/LICENSE)と[ThirdPartyNotices.txt](https://raw.githubusercontent.com/microsoft/onnxruntime/v1.29.0/ThirdPartyNotices.txt)を同じ版で保存した。

`node scripts/prepare-face-check.mjs`は、検証済みモデルとインストール済みランタイムからWASM・mjs・許諾文を`public/face-check/`へコピーする。取得先を実行時に変更せず、CDNへの代替取得を行わない。生成資産はGitに含めず、開発起動とビルドの前に準備する。Prismaのpostinstallは維持する。
