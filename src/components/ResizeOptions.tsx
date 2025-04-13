import React, { useEffect, useState } from 'react';
import type { ResizeOptions } from '../types';

const presets: { [key in '100' | '50' | '33' | '20' | '10']: { width: number; height: number } } = {
    '100': { width: 6960, height: 4640 },
    '50': { width: Math.round(6960 * 0.5), height: Math.round(4640 * 0.5) },
    '33': { width: Math.round(6960 * 0.33), height: Math.round(4640 * 0.33) },
    '20': { width: Math.round(6960 * 0.2), height: Math.round(4640 * 0.2) },
    '10': { width: Math.round(6960 * 0.1), height: Math.round(4640 * 0.1) },
};

export function ResizeOptions({
    options,
    onOptionsChange,
}: {
    options: ResizeOptions;
    onOptionsChange: (options: ResizeOptions) => void;
}) {
    // Local state for width, height, and computed aspect ratio.
    const [localWidth, setLocalWidth] = useState(options.width);
    const [localHeight, setLocalHeight] = useState(options.height);
    const [aspectRatio, setAspectRatio] = useState(options.height !== 0 ? options.width / options.height : 1);

    // Update local state when props change.
    useEffect(() => {
        setLocalWidth(options.width);
        setLocalHeight(options.height);
        if (options.height !== 0) {
            setAspectRatio(options.width / options.height);
        }
    }, [options.width, options.height]);

    const handlePresetChange = (value: string) => {
        if (value !== "custom") {
          const preset = presets[value as '100' | '50' | '33' | '20' | '10'];
          setLocalWidth(preset.width);
          setLocalHeight(preset.height);
          onOptionsChange({ ...options, preset: value as any, width: preset.width, height: preset.height });
        } else {
          onOptionsChange({ ...options, preset: "custom" });
        }
      };
      

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWidth = Number(e.target.value);
        setLocalWidth(newWidth);

        if (options.maintainAspectRatio && aspectRatio) {
            const newHeight = Math.round(newWidth / aspectRatio);
            setLocalHeight(newHeight);
            onOptionsChange({ ...options, width: newWidth, height: newHeight, preset: 'custom' });
        } else {
            onOptionsChange({ ...options, width: newWidth, preset: 'custom' });
        }
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHeight = Number(e.target.value);
        setLocalHeight(newHeight);

        if (options.maintainAspectRatio && newHeight !== 0) {
            const newWidth = Math.round(newHeight * aspectRatio);
            setLocalWidth(newWidth);
            onOptionsChange({ ...options, height: newHeight, width: newWidth, preset: 'custom' });
        } else {
            onOptionsChange({ ...options, height: newHeight, preset: 'custom' });
        }
    };

    const handleAspectRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const lock = e.target.checked;
        if (lock && localHeight !== 0) {
            setAspectRatio(localWidth / localHeight);
        }
        onOptionsChange({ ...options, maintainAspectRatio: lock });
    };

    return (
        <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm mt-6">
            <h2 className="text-xl font-bold text-gray-900">Resize Options</h2>
            <div className="flex items-center gap-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={options.enabled}
                        onChange={(e) => onOptionsChange({ ...options, enabled: e.target.checked })}
                        className="mr-2"
                    />
                    Enable Resize
                </label>
            </div>

            {options.enabled && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preset</label>
                        <select
                            value={options.preset}
                            onChange={(e) => handlePresetChange(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2"
                        >
                            {Object.keys(presets).map((key) => (
                                <option key={key} value={key}>
                                    {key}%
                                </option>
                            ))}
                            <option value="custom">Custom</option>
                        </select>
                    </div>


                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Width (px)
                            </label>
                            <input
                                type="number"
                                value={localWidth}
                                onChange={handleWidthChange}
                                onBlur={(e) => {
                                    const newVal = parseInt(e.target.value, 10) || 0;
                                    setLocalWidth(newVal);
                                    onOptionsChange({ ...options, width: newVal, preset: 'custom' });
                                }}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Height (px)
                            </label>
                            <input
                                type="number"
                                value={localHeight}
                                onChange={handleHeightChange}
                                onBlur={(e) => {
                                    const newVal = parseInt(e.target.value, 10) || 0;
                                    setLocalHeight(newVal);
                                    onOptionsChange({ ...options, height: newVal, preset: 'custom' });
                                }}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            />
                        </div>
                    </div>
                    <div className="mt-2">
                        <span className="block text-sm text-gray-700">Method: Lanczos3 (fixed)</span>
                    </div>
                </>
            )}
        </div>
    );
}
