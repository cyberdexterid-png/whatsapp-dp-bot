#!/usr/bin/env python3
"""
Generates assets/dp-success.mp4 — an auto-playing animated "DP UPLOAD SUCCESS /
Make by VENOM" card. The bot sends it as a WhatsApp GIF (gifPlayback) so it
plays live in the chat like a video.

  python3 tools/make_success_video.py

Requires: Pillow (PIL), ffmpeg on PATH, DejaVu fonts (present on most Linux).
"""
import math
import os
import random
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 480, 480
FPS = 12
DUR = 4.0
NFRAMES = int(FPS * DUR)

BG = (11, 15, 20)
GREEN = (37, 211, 102)
GOLD = (245, 197, 24)
WHITE = (255, 255, 255)
DIM = (140, 160, 175)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def ease_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_out_back(t):
    t = max(0.0, min(1.0, t))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def clamp01(t):
    return max(0.0, min(1.0, t))


def center_text(draw, cx, y, text, fnt, fill):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    w = bbox[2] - bbox[0]
    draw.text((cx - w / 2, y), text, font=fnt, fill=fill)


def rounded_bar(draw, x0, y0, x1, y1, r, fill):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)


random.seed(7)
PARTICLES = [
    (random.uniform(0, W), random.uniform(0, H), random.uniform(8, 26),
     random.uniform(1.5, 3.5), random.uniform(0, 6.28))
    for _ in range(26)
]


def draw_frame(i):
    t = i / FPS  # seconds
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img, "RGBA")

    # --- background: soft pulsing radial glow ---
    pulse = 0.5 + 0.5 * math.sin(t * 2.2)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = int(150 + 60 * pulse)
    gd.ellipse([W / 2 - gr, H / 2 - gr - 40, W / 2 + gr, H / 2 + gr - 40],
               fill=(20, 60, 45, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")

    # --- drifting particles ---
    for (px, py, spd, sz, ph) in PARTICLES:
        yy = (py - t * spd) % (H + 20) - 10
        a = int(50 + 40 * math.sin(t * 1.5 + ph))
        d.ellipse([px - sz, yy - sz, px + sz, yy + sz], fill=(120, 200, 160, max(0, a)))

    cx = W / 2

    # --- phase 1: uploading progress (0 - 1.1s) ---
    if t < 1.25:
        p = ease_out_cubic(t / 1.1)
        center_text(d, cx, 150, "UPLOADING DP", font(30), WHITE)
        # track
        rounded_bar(d, 70, 230, 410, 252, 11, (35, 45, 55, 255))
        fw = 70 + 340 * p
        if fw > 72:
            rounded_bar(d, 70, 230, fw, 252, 11, GREEN + (255,))
        center_text(d, cx, 275, f"{int(p * 100)}%", font(24), DIM)
        # spinner dots
        for k in range(3):
            a = int(120 + 120 * math.sin(t * 8 - k * 1.2))
            d.ellipse([cx - 24 + k * 24 - 5, 340 - 5, cx - 24 + k * 24 + 5, 340 + 5],
                      fill=(255, 255, 255, max(0, a)))

    # --- phase 2: checkmark pop (1.1 - 1.7s) ---
    if 1.05 < t < 1.75:
        p = clamp01((t - 1.05) / 0.35)
        s = ease_out_back(p)
        r = 52 * s
        if r > 1:
            d.ellipse([cx - r, 190 - r, cx + r, 190 + r], outline=GREEN + (255,), width=7)
            # check mark
            cr = r * 0.55
            pts = [(cx - cr, 190), (cx - cr * 0.15, 190 + cr * 0.75), (cx + cr * 1.05, 190 - cr * 0.7)]
            if p > 0.35:
                d.line(pts, fill=GREEN + (255,), width=9, joint="curve")

    # --- phase 3: success card (1.5s -> end) ---
    if t >= 1.5:
        p = ease_out_cubic((t - 1.5) / 0.5)
        # card panel slides/fades in
        card_a = int(255 * p)
        top = 120 + int(30 * (1 - p))
        d.rounded_rectangle([50, top, 430, 400], radius=26, fill=(20, 28, 36, card_a))
        d.rounded_rectangle([50, top, 430, 400], radius=26, outline=(37, 211, 102, card_a), width=3)

        if p > 0.15:
            q = ease_out_cubic((p - 0.15) / 0.85)
            # small check badge
            br = 26 * ease_out_back(clamp01((t - 1.55) / 0.3))
            if br > 1:
                d.ellipse([cx - br, top + 34 - br, cx + br, top + 34 + br], fill=GREEN + (255,))
                cr = br * 0.5
                d.line([(cx - cr, top + 34), (cx - cr * 0.1, top + 34 + cr * 0.7),
                        (cx + cr, top + 34 - cr * 0.65)], fill=(255, 255, 255, 255), width=6, joint="curve")
            ta = int(255 * q)
            center_text(d, cx, top + 78, "DP UPLOAD", font(34), WHITE + (ta,))
            center_text(d, cx, top + 122, "SUCCESS", font(34), GREEN + (ta,))
            # divider
            d.line([110, top + 178, 370, top + 178], fill=(90, 110, 125, ta), width=2)
            # VENOM branding with pulsing glow
            gpulse = 0.6 + 0.4 * math.sin(t * 3.0)
            ga = int(160 * gpulse * q)
            glow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gd2 = ImageDraw.Draw(glow2)
            gd2.ellipse([cx - 130, top + 196 - 26, cx + 130, top + 196 + 26], fill=(245, 197, 24, ga // 3))
            glow2 = glow2.filter(ImageFilter.GaussianBlur(25))
            img = Image.alpha_composite(img.convert("RGBA"), glow2).convert("RGB")
            d = ImageDraw.Draw(img, "RGBA")
            # lightning bolt
            def bolt(bx):
                return [(bx - 16, top + 208), (bx, top + 208), (bx - 8, top + 224),
                        (bx + 6, top + 224), (bx - 14, top + 248), (bx - 6, top + 228), (bx - 20, top + 228)]
            d.polygon(bolt(cx - 152), fill=GOLD + (ta,))
            d.polygon(bolt(cx + 152), fill=GOLD + (ta,))
            center_text(d, cx, top + 200, "MAKE BY VENOM", font(24), GOLD + (ta,))

    # --- fade in/out for smooth looping ---
    if i < 5:
        img = Image.blend(Image.new("RGB", (W, H), BG), img, i / 5)
    if i >= NFRAMES - 5:
        img = Image.blend(Image.new("RGB", (W, H), BG), img, (NFRAMES - 1 - i) / 5)

    return img


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
    os.makedirs(out_dir, exist_ok=True)
    out_mp4 = os.path.join(out_dir, "dp-success.mp4")

    with tempfile.TemporaryDirectory() as tmp:
        for i in range(NFRAMES):
            frame = draw_frame(i)
            frame.save(os.path.join(tmp, f"f{i:03d}.png"))
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-framerate", str(FPS), "-i", os.path.join(tmp, "f%03d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
            "-movflags", "+faststart", out_mp4,
        ]
        subprocess.run(cmd, check=True)

    size = os.path.getsize(out_mp4)
    print(f"wrote {out_mp4} ({size / 1024:.0f} KB, {NFRAMES} frames @ {FPS}fps)")

    # The GitHub push API is text-only, so commit a base64 copy — that is what
    # ships in the repo; bot.js decodes it at startup.
    import base64
    out_b64 = out_mp4 + ".b64"
    with open(out_mp4, "rb") as f_in, open(out_b64, "w") as f_out:
        f_out.write(base64.b64encode(f_in.read()).decode("ascii"))
    print(f"wrote {out_b64} (base64, committed to git instead of the mp4)")


if __name__ == "__main__":
    sys.exit(main())
