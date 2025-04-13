import React from 'react';

interface ProcessingOptionsProps {
  processLevel: number;
  onChange: (level: number) => void;
}

export function ProcessingOptions({ processLevel, onChange }: ProcessingOptionsProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mt-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Processing Intensity (1: very light, 4: aggressive)
      </label>
      <input
        type="range"
        min="1"
        max="4"
        step="1"
        value={processLevel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <p className="text-sm text-gray-600">Current Level: {processLevel}</p>
    </div>
  );
}
