// 一時停止ボタン（本番にも残す部分）
const root = document.documentElement;
const toggle = document.querySelector(".motion-toggle");
toggle?.addEventListener("click", () => {
  const paused = root.toggleAttribute("data-paused");
  toggle.setAttribute("aria-pressed", String(paused));
  toggle.textContent = paused ? "動きを再開する" : "動きを止める";
});

// ここから下はモック確認用（本番では消す）
const panel = document.createElement("form");
panel.className = "mock-panel";
panel.setAttribute("aria-label", "モック確認用の設定");
panel.innerHTML = `
  <fieldset><legend>動きの量</legend>
    <label><input type="radio" name="motion" value="lively" checked>にぎやか</label>
    <label><input type="radio" name="motion" value="">控えめ</label>
    <label><input type="radio" name="motion" value="off">なし</label>
  </fieldset>
  <fieldset><legend>blob の量</legend>
    <label><input type="radio" name="blobs" value="" checked>多め</label>
    <label><input type="radio" name="blobs" value="few">少なめ</label>
  </fieldset>
  <fieldset><legend>blob の濃さ</legend>
    <label><input type="radio" name="strength" value="" checked>標準（0.4）</label>
    <label><input type="radio" name="strength" value="strong">濃い（0.55・本文が基準割れ）</label>
  </fieldset>
  <button class="mock-panel__close" type="button">この設定パネルを隠す</button>`;
panel.addEventListener("change", (e) => {
  const { name, value } = e.target;
  value ? root.setAttribute(`data-${name}`, value) : root.removeAttribute(`data-${name}`);
});
panel.querySelector(".mock-panel__close").addEventListener("click", () => { panel.hidden = true; });
document.body.append(panel);
