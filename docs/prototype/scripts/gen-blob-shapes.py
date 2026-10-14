"""blob の形（clip-path: shape()）と変形アニメーションの CSS を生成する。

使い方: docker compose run --rm -w /work dev uv run --no-project python docs/prototype/scripts/gen-blob-shapes.py > site/src/styles/blobs.css

各形は箱に対する % の頂点列で定義し、Catmull-Rom 曲線で滑らかにつなぐ。
頂点ごとの張り（0 で尖る、1 で丸い）で、角の丸みを調整する。
変形は、同じ頂点数のまま位置を揺らした形を3つ作って補間する（頂点数が同じなら shape() は補間できる）。
"""
import random

# (x%, y%, 張り)。時計回り。
SHAPES = {
    # 2023 チラシの形にならい、尖りを作らず（張りはすべて 1）房の先も丸める
    # ロゴの背後の大きい形（房が3つある不定形）
    "s1": [(6, 45, 1), (18, 18, 1), (42, 22, 1), (58, 8, 1), (80, 14, 1), (92, 38, 1),
           (80, 58, 1), (94, 82, 1), (66, 94, 1), (40, 84, 1), (18, 92, 1), (10, 70, 1)],
    # 縦長のしずく形
    "s2": [(28, 6, 1), (68, 4, 1), (92, 30, 1), (82, 58, 1), (62, 94, 1), (36, 86, 1), (12, 52, 1)],
    # くびれのある豆形
    "s3": [(4, 50, 1), (18, 14, 1), (54, 4, 1), (90, 22, 1), (96, 60, 1), (72, 94, 1), (48, 72, 1), (20, 92, 1)],
    # 角の丸い三角
    "s4": [(10, 12, 1), (58, 26, 1), (92, 84, 1), (36, 90, 1), (14, 62, 1)],
    # 丸みのあるレンズ形
    "s5": [(6, 68, 1), (30, 20, 1), (78, 8, 1), (76, 52, 1), (42, 90, 1)],
}

JITTER = 7  # 変形の振れ幅（%）
random.seed(2026)


def path(points):
    n = len(points)
    f = lambda v: f"{max(-5.0, min(105.0, v)):.1f}%"
    out = [f"from {f(points[0][0])} {f(points[0][1])}"]
    for i in range(n):
        p0, p1, p2, p3 = (points[(i + k) % n] for k in (-1, 0, 1, 2))
        t1, t2 = p1[2], p2[2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t1, p1[1] + (p2[1] - p0[1]) / 6 * t1)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t2, p2[1] - (p3[1] - p1[1]) / 6 * t2)
        out.append(f"curve to {f(p2[0])} {f(p2[1])} with {f(c1[0])} {f(c1[1])} / {f(c2[0])} {f(c2[1])}")
    return "shape(" + ", ".join(out) + ", close)"


def jitter(points):
    return [(x + random.uniform(-JITTER, JITTER), y + random.uniform(-JITTER, JITTER), t) for x, y, t in points]


print("/* 生成物。直接編集せず scripts/gen-blob-shapes.py を直して再生成する */")
print("@supports (clip-path: shape(from 0% 0%, line to 100% 100%)) {")
print("  .blob { border-radius: 0; }")
for name, pts in SHAPES.items():
    print(f"  .blob--{name} {{ --morph: blob-{name}; clip-path: {path(pts)}; }}")
    frames = [pts, jitter(pts), jitter(pts), pts]
    print(f"  @keyframes blob-{name} {{")
    for pct, fr in zip((0, 33, 66, 100), frames):
        print(f"    {pct}% {{ clip-path: {path(fr)}; }}")
    print("  }")
print("}")
