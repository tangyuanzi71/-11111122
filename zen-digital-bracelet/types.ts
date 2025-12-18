export interface HandLandmarkResult {
  landmarks: Array<Array<{ x: number; y: number; z: number }>>;
  worldLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
}

export interface FloatingLetterData {
  id: string;
  char: string;
  x: number;
  y: number;
  z: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  scale: number;
}
