import React from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording }) => {
  if (!isRecording) return null;

  return (
    <div className="flex items-center justify-center space-x-1 h-12">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-2 bg-blue-500 rounded-full animate-wave"
          style={{
            height: '100%',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );
};
