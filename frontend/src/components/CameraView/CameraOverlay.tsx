import type { CameraStatus } from '../../types/index.ts';
import { Spinner } from '../Common/Spinner.tsx';

interface CameraOverlayProps {
  status: CameraStatus;
  isProcessing: boolean;
}

export function CameraOverlay({ status, isProcessing }: CameraOverlayProps) {
  const isReady =
    status.isActive &&
    status.framing === 'good' &&
    status.brightness === 'good';

  const getWarningText = () => {
    if (status.framing === 'hands_not_visible') return 'Hands not visible';
    if (status.framing === 'too_far') return 'Move hands closer to camera';
    if (status.framing === 'too_close') return 'Move hands farther back';
    if (status.brightness === 'too_dark') return 'Too dark - try better lighting';
    if (status.brightness === 'too_bright') return 'Too bright - reduce lighting';
    return null;
  };

  if (isProcessing) {
    return (
      <div className="camera-overlay camera-overlay--processing">
        <div className="camera-overlay__scan-line" />
        <div className="camera-overlay__status camera-overlay__status--processing">
          <Spinner size={20} />
          <span>Interpreting your sign...</span>
        </div>
      </div>
    );
  }

  if (!status.isActive) {
    return (
      <div className="camera-overlay">
        <div className="camera-overlay__status camera-overlay__status--inactive">
          <span>Camera off</span>
        </div>
      </div>
    );
  }

  const warning = getWarningText();
  if (warning) {
    return (
      <div className="camera-overlay">
        <div className="camera-overlay__status camera-overlay__status--warning">
          <span>{warning}</span>
        </div>
      </div>
    );
  }

  if (isReady) {
    return (
      <div className="camera-overlay camera-overlay--ready">
        <div className="camera-overlay__status camera-overlay__status--ready">
          <span className="camera-overlay__ready-dot" />
          <span>Listening</span>
        </div>
      </div>
    );
  }

  return null;
}
