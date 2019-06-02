import Math  from './Math'

//optimized kdbush
export default class KDTree {
  constructor(nodeSize) {
    this.nodeSize = nodeSize || 64

    this.ids = []
    this.coords = []
    this.length = 0
  }

  reset() {
    this.length = 0
  }

  addPoint(point) {
    let i = this.length++

    this.ids[i] = i

    this.coords[2 * i] = point[0]
    this.coords[2 * i + 1] = point[1]
  }

  setPoints(points) {
    this.length = points.length
    //this.ids.length = points.length;
    //this.coords.length = points.length * 2;

    for (let i = 0; i < points.length; i++) {
      this.ids[i] = i

      let point = points[i]
      this.coords[2 * i] = point[0]
      this.coords[2 * i + 1] = point[1]
    }
  }

  sort() {
    sortKD(this.ids, this.coords, this.nodeSize, 0, this.length - 1, 0)
  }

  range(minX, minY, maxX, maxY) {
    const ids = this.ids
    const coords = this.coords
    const nodeSize = this.nodeSize
    const stack = [0, this.length - 1, 0]
    const result = []
    let x
    let y

    while (stack.length) {
      const axis = stack.pop()
      const right = stack.pop()
      const left = stack.pop()

      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          x = coords[2 * i]
          y = coords[2 * i + 1]
          if (x >= minX && x <= maxX && y >= minY && y <= maxY)
            result.push(ids[i])
        }
        continue
      }

      const m = Math.floor((left + right) / 2)

      x = coords[2 * m]
      y = coords[2 * m + 1]

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m])

      const nextAxis = (axis + 1) % 2

      if (axis === 0 ? minX <= x : minY <= y) {
        stack.push(left)
        stack.push(m - 1)
        stack.push(nextAxis)
      }
      if (axis === 0 ? maxX >= x : maxY >= y) {
        stack.push(m + 1)
        stack.push(right)
        stack.push(nextAxis)
      }
    }

    return result
  }

  within(qx, qy, r) {
    const ids = this.ids
    const coords = this.coords
    const nodeSize = this.nodeSize
    const stack = [0, this.length - 1, 0]
    const result = []
    const r2 = r * r

    while (stack.length) {
      const axis = stack.pop()
      const right = stack.pop()
      const left = stack.pop()

      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2)
            result.push(ids[i])
        }
        continue
      }

      const m = Math.floor((left + right) / 2)

      const x = coords[2 * m]
      const y = coords[2 * m + 1]

      if (sqDist(x, y, qx, qy) <= r2) result.push(ids[m])

      const nextAxis = (axis + 1) % 2

      if (axis === 0 ? qx - r <= x : qy - r <= y) {
        stack.push(left)
        stack.push(m - 1)
        stack.push(nextAxis)
      }
      if (axis === 0 ? qx + r >= x : qy + r >= y) {
        stack.push(m + 1)
        stack.push(right)
        stack.push(nextAxis)
      }
    }

    return result
  }
}

function sqDist(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function sortKD(ids, coords, nodeSize, left, right, depth) {
  if (right - left <= nodeSize) return

  const m = Math.floor((left + right) / 2)

  select(ids, coords, m, left, right, depth % 2)

  sortKD(ids, coords, nodeSize, left, m - 1, depth + 1)
  sortKD(ids, coords, nodeSize, m + 1, right, depth + 1)
}

function select(ids, coords, k, left, right, inc) {
  while (right > left) {
    if (right - left > 600) {
      const n = right - left + 1
      const m = k - left + 1
      const z = Math.log(n)
      const s = 0.5 * Math.exp((2 * z) / 3)
      const sd =
        0.5 * Math.sqrt((z * s * (n - s)) / n) * (m - n / 2 < 0 ? -1 : 1)
      const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd))
      const newRight = Math.min(right, Math.floor(k + ((n - m) * s) / n + sd))
      select(ids, coords, k, newLeft, newRight, inc)
    }

    const t = coords[2 * k + inc]
    let i = left
    let j = right

    swapItem(ids, coords, left, k)
    if (coords[2 * right + inc] > t) swapItem(ids, coords, left, right)

    while (i < j) {
      swapItem(ids, coords, i, j)
      i++
      j--
      while (coords[2 * i + inc] < t) i++
      while (coords[2 * j + inc] > t) j--
    }

    if (coords[2 * left + inc] === t) swapItem(ids, coords, left, j)
    else {
      j++
      swapItem(ids, coords, j, right)
    }

    if (j <= k) left = j + 1
    if (k <= j) right = j - 1
  }
}

function swapItem(ids, coords, i, j) {
  swap(ids, i, j)
  swap(coords, 2 * i, 2 * j)
  swap(coords, 2 * i + 1, 2 * j + 1)
}

function swap(arr, i, j) {
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
}
