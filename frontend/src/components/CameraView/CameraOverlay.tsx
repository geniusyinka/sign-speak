import type { CameraStatus } from '../../types/index.ts';
import { Spinner } from '../Common/Spinner.tsx';

interface CameraOverlayProps {
  status: CameraStatus;
  isProcessing: boolean;
}

export function CameraOverlay({ status, isProcessing }: CameraOverlayProps) {
  const getStatusText = () => {
    if (isProcessing) return 'Interpreting...';
    if (!status.isActive) return 'Camera off';
    if (status.framing === 'hands_not_visible') return 'Hands not visible';
    if (status.framing === 'too_far') return 'Move hands closer to camera';
    if (status.framing === 'too_close') return 'Move hands farther back';
    if (status.brightness === 'too_dark') return 'Too dark - try better lighting';
    if (status.brightness === 'too_bright') return 'Too bright - reduce lighting';
    return 'Ready to interpret';
  };

  const getStatusClass = () => {
    if (isProcessing) return 'camera-overlay__status--processing';
    if (!status.isActive) return 'camera-overlay__status--inactive';
    if (status.framing !== 'good') return 'camera-overlay__status--warning';
    if (status.brightness !== 'good') return 'camera-overlay__status--warning';
    return 'camera-overlay__status--ready';
  };

  return (
    <div className="camera-overlay">
      <div className={`camera-overlay__status ${getStatusClass()}`}>
        {isProcessing && <Spinner size={16} />}
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
}
