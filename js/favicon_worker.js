const frameDuration = 100; // ms per frame
const loopDelay = 2000;    // ms to pause between each full playthrough

let images = [];
let canvas, ctx;

self.onmessage = async function (e) {
  if (e.data.type === 'init') {
    canvas = new OffscreenCanvas(32, 32);
    ctx = canvas.getContext('2d');

    for (const src of e.data.images) {
      const response = await fetch(src);
      const blob = await response.blob();
      images.push(await createImageBitmap(blob));
    }

    playLoop();
  }
};

function drawFrame(index) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
  canvas.convertToBlob().then(blob => {
    const reader = new FileReader();
    reader.onloadend = () => {
      self.postMessage({ type: 'updateFavicon', dataUrl: reader.result });
    };
    reader.readAsDataURL(blob);
  });
}

function playLoop() {
  let frame = 0;

  function step() {
    drawFrame(frame);
    frame++;
    if (frame < images.length) {
      setTimeout(step, frameDuration);
    } else {
      setTimeout(playLoop, loopDelay);
    }
  }

  step();
}
