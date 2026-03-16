import { useSettings } from '../../context/SettingsContext.tsx';
import type { VoiceOption } from '../../types/index.ts';

const VOICES: VoiceOption[] = [
  { id: 'en-US-Neural2-F', name: 'Emma', gender: 'female' },
  { id: 'en-US-Neural2-C', name: 'Ava', gender: 'female' },
  { id: 'en-US-Neural2-D', name: 'James', gender: 'male' },
  { id: 'en-US-Neural2-A', name: 'Michael', gender: 'male' },
];

const TEXT_SIZES = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
  { value: 'xlarge' as const, label: 'Extra Large' },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="settings-panel__header">
          <h2>Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="settings-panel__close">
            &times;
          </button>
        </div>

        <div className="settings-panel__section">
          <h3>Voice</h3>
          <div className="settings-panel__voices">
            {VOICES.map((voice) => (
              <label key={voice.id} className="settings-panel__voice-option">
                <input
                  type="radio"
                  name="voice"
                  checked={settings.voiceId === voice.id}
                  onChange={() => updateSettings({ voiceId: voice.id, voiceName: voice.name })}
                />
                <span>
                  {voice.name} ({voice.gender})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-panel__section">
          <h3>Text Size</h3>
          <div className="settings-panel__text-sizes">
            {TEXT_SIZES.map((size) => (
              <button
                key={size.value}
                className={`settings-panel__size-btn ${settings.textSize === size.value ? 'settings-panel__size-btn--active' : ''}`}
                onClick={() => updateSettings({ textSize: size.value })}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-panel__section">
          <h3>Display</h3>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => updateSettings({ highContrast: e.target.checked })}
            />
            High contrast mode
          </label>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.showHistory}
              onChange={(e) => updateSettings({ showHistory: e.target.checked })}
            />
            Show conversation history
          </label>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.autoHideCamera}
              onChange={(e) => updateSettings({ autoHideCamera: e.target.checked })}
            />
            Auto-hide camera when speech detected
          </label>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.handsDownSegmentation}
              onChange={(e) => updateSettings({ handsDownSegmentation: e.target.checked })}
            />
            Finish signing only when hands leave frame
          </label>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.showAslGloss}
              onChange={(e) => updateSettings({ showAslGloss: e.target.checked })}
            />
            Show ASL gloss for spoken input
          </label>
          <label className="settings-panel__toggle">
            <input
              type="checkbox"
              checked={settings.continuousListening}
              onChange={(e) => updateSettings({ continuousListening: e.target.checked })}
            />
            Keep Listen Mode microphone always on
          </label>
        </div>
      </div>
    </div>
  );
}
