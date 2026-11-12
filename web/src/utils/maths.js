export function lerp(x, y, a) {
	return (1 - a) * x + a * y
}

export function damp(x, y, a, dt) {
	return lerp(x, y, 1 - Math.exp(-a * 0.05 * dt))
}

export function clamp(value, min, max) {
	return Math.max(min, Math.min(value, max))
}