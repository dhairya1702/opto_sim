import { Canvas as FiberCanvas, type CanvasProps } from "@react-three/fiber";

export function PracticeWebGLFallback() {
  return (
    <div className="practice-webgl-fallback" role="alert">
      <strong>3D practice view unavailable</strong>
      <p>Enable WebGL or hardware acceleration in your browser, then close and reopen this practice attempt.</p>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return <FiberCanvas fallback={<PracticeWebGLFallback />} {...props} />;
}
