// Adds a closed circle as its own sub-path. Using moveTo first stops the
// canvas from drawing a connecting line from the previous sub-path.
// Many circles in one path filled once give a union with no overlap darkening.
export function addCircle(ctx, x, y, r) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// Same idea as addCircle, for an ellipse rotated by `rotation` radians.
export function addEllipse(ctx, x, y, rx, ry, rotation) {
  ctx.moveTo(x + rx * Math.cos(rotation), y + rx * Math.sin(rotation));
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
}

export function isInView(view, x, y, margin) {
  return (
    x + margin >= view.left &&
    x - margin <= view.right &&
    y + margin >= view.top &&
    y - margin <= view.bottom
  );
}
