import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Play,
  Pause,
  Download,
  Camera
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Marker {
  x: number;
  y: number;
  placed: boolean;
}

interface Measurement {
  upperAngle: string;
  lowerAngle: string;
  midlineDeviation: string;
}

const MetaOrthoAndroid: React.FC = () => {
  const [arActive, setArActive] = useState<boolean>(false);
  const [currentMarkerPlacement, setCurrentMarkerPlacement] = useState<string>('upper_left_central');
  const [placedMarkers, setPlacedMarkers] = useState<Record<string, Marker>>({});
  const [measurements, setMeasurements] = useState<Measurement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Camera and image handling
  const [cameraOpen, setCameraOpen] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setCameraOpen(true);
    }
  };

  // Cleanup URL object to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const markerSequence = [
    { id: 'upper_left_central', name: 'Upper Left Central Incisor', color: '#3B82F6' },
    { id: 'upper_left_lateral', name: 'Upper Left Lateral Incisor', color: '#3B82F6' },
    { id: 'upper_right_central', name: 'Upper Right Central Incisor', color: '#3B82F6' },
    { id: 'upper_right_lateral', name: 'Upper Right Lateral Incisor', color: '#3B82F6' },
    { id: 'lower_left_central', name: 'Lower Left Central Incisor', color: '#10B981' },
    { id: 'lower_left_lateral', name: 'Lower Left Lateral Incisor', color: '#10B981' },
    { id: 'lower_right_central', name: 'Lower Right Central Incisor', color: '#10B981' },
    { id: 'lower_right_lateral', name: 'Lower Right Lateral Incisor', color: '#10B981' },
  ];

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!arActive || !currentMarkerPlacement) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const newMarkers = {
      ...placedMarkers,
      [currentMarkerPlacement]: { x, y, placed: true }
    };
    setPlacedMarkers(newMarkers);

    const currentIndex = markerSequence.findIndex((m) => m.id === currentMarkerPlacement);
    if (currentIndex < markerSequence.length - 1) {
      setCurrentMarkerPlacement(markerSequence[currentIndex + 1].id);
    } else {
      setCurrentMarkerPlacement('');
      calculateMeasurements(newMarkers);
    }
  };

  const resetMarkers = () => {
    setPlacedMarkers({});
    setCurrentMarkerPlacement('upper_left_central');
    setMeasurements(null);
    setCameraOpen(false);
    setImageUrl(null);
    if (imageRef.current) {
      imageRef.current.src = '';
    }
  };

  const getMarkerColor = (id: string): string => markerSequence.find((m) => m.id === id)?.color || '#cccccc';

  const calculateMeasurements = (points: Record<string, Marker>) => {
    const required = [
      'upper_left_central', 'upper_right_central',
      'lower_left_central', 'lower_right_central'
    ];

    if (required.every((id) => points[id])) {
      const upperAngle = getAngle(points.upper_left_central, points.upper_right_central);
      const lowerAngle = getAngle(points.lower_left_central, points.lower_right_central);
      const midlineDeviation = Math.abs(upperAngle - lowerAngle).toFixed(1);

      setMeasurements({
        upperAngle: upperAngle.toFixed(1),
        lowerAngle: lowerAngle.toFixed(1),
        midlineDeviation
      });
    }
  };

  const getAngle = (p1: Marker, p2: Marker): number => {
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  };

  const exportResults = async () => {
    if (!measurements || !canvasRef.current) {
      alert("No measurements to export or canvas not found");
      return;
    }

    try {
      // Wait for rendering to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Clone the canvas to manipulate styles
      const canvasClone = canvasRef.current.cloneNode(true) as HTMLDivElement;
      document.body.appendChild(canvasClone);

      // Remove or convert problematic styles (e.g., oklch)
      const elements = canvasClone.querySelectorAll('*');
      elements.forEach((el: HTMLElement) => {
        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.backgroundColor.includes('oklch')) {
          el.style.backgroundColor = '#f3f4f6'; // Fallback to a safe color
        }
        if (computedStyle.color.includes('oklch')) {
          el.style.color = '#000000'; // Fallback to black
        }
      });

      const screenshot = await html2canvas(canvasClone, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#f3f4f6',
        logging: false,
        onclone: (doc, element) => {
          // Ensure SVG and image are included
          const svg = element.querySelector('svg');
          if (svg) {
            svg.style.backgroundColor = '#f3f4f6';
          }
          const img = element.querySelector('img');
          if (img) {
            img.crossOrigin = 'anonymous';
          }
        }
      });

      // Clean up the cloned element
      document.body.removeChild(canvasClone);

      const imgData = screenshot.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');

      // Add title and measurements
      doc.setFontSize(16);
      doc.text("Midline Analysis Report", 20, 20);
      doc.setFontSize(12);
      doc.text(`Upper Angle: ${measurements.upperAngle}°`, 20, 30);
      doc.text(`Lower Angle: ${measurements.lowerAngle}°`, 20, 40);
      doc.text(`Midline Deviation: ${measurements.midlineDeviation}°`, 20, 50);

      // Calculate image dimensions to fit A4
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth() - 40;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      doc.addImage(imgData, 'PNG', 20, 60, pdfWidth, pdfHeight);
      doc.save("midline_report.pdf");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Failed to export PDF. Ensure all markers are placed and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-gray-800">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
          <h1 className="text-3xl font-bold text-blue-700 mb-1">MetaOrtho AR</h1>
          <p className="text-sm text-gray-500">8-Point Incisor Marker Placement with AR Analysis</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-blue-600 flex items-center cursor-pointer">
                <div onClick={handleCamera} className='flex text-lg items-center'>
                  <Camera className="w-4 h-4 mr-2" /> AR Canvas
                </div>
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setArActive(!arActive)}
                  className={`px-3 py-1 rounded-lg text-sm text-white transition ${arActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {arActive ? <Pause className="w-4 h-4 inline mr-1" /> : <Play className="w-4 h-4 inline mr-1" />}
                  {arActive ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={resetMarkers}
                  className="px-3 py-1 rounded-lg text-sm bg-gray-500 hover:bg-gray-600 text-white"
                >
                  <RotateCcw className="w-4 h-4 inline mr-1" /> Reset
                </button>
              </div>
            </div>

            <div
              className="relative bg-gray-100 border border-dashed border-gray-400 rounded-xl overflow-hidden cursor-crosshair h-72"
              onClick={handleCanvasClick}
              ref={canvasRef}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />

              {cameraOpen && imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Captured"
                  className="absolute w-full h-full object-contain bg-transparent"
                />
              )}

              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {measurements && placedMarkers.upper_left_central && placedMarkers.upper_right_central && (
                  <line
                    x1={placedMarkers.upper_left_central.x}
                    y1={placedMarkers.upper_left_central.y}
                    x2={placedMarkers.upper_right_central.x}
                    y2={placedMarkers.upper_right_central.y}
                    stroke="#3B82F6"
                    strokeWidth="2"
                  />
                )}
                {measurements && placedMarkers.lower_left_central && placedMarkers.lower_right_central && (
                  <line
                    x1={placedMarkers.lower_left_central.x}
                    y1={placedMarkers.lower_left_central.y}
                    x2={placedMarkers.lower_right_central.x}
                    y2={placedMarkers.lower_right_central.y}
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                )}
                {Object.entries(placedMarkers).map(([id, marker]) => (
                  <g key={id}>
                    <circle cx={marker.x} cy={marker.y} r="8" fill={getMarkerColor(id)} />
                    <circle cx={marker.x} cy={marker.y} r="4" fill="white" />
                    <text x={marker.x} y={marker.y - 10} textAnchor="middle" fontSize="10" fill="black">
                      {id.split('_').map(w => w[0]).join('').toUpperCase()}
                    </text>
                  </g>
                ))}
                {placedMarkers.upper_left_lateral && placedMarkers.upper_right_lateral && (
                  <>
                    {/* Original line between lateral incisors for reference */}
                    <line
                      x1={placedMarkers.upper_left_lateral.x}
                      y1={placedMarkers.upper_left_lateral.y}
                      x2={placedMarkers.upper_right_lateral.x}
                      y2={placedMarkers.upper_right_lateral.y}
                      stroke="#888888"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    {/* Perpendicular dotted midline */}
                    <line
                      x1={(placedMarkers.upper_left_lateral.x + placedMarkers.upper_right_lateral.x) / 2}
                      y1={(placedMarkers.upper_left_lateral.y + placedMarkers.upper_right_lateral.y) / 2}
                      x2={(placedMarkers.upper_left_lateral.x + placedMarkers.upper_right_lateral.x) / 2 + 100 * (-(placedMarkers.upper_right_lateral.y - placedMarkers.upper_left_lateral.y) / Math.sqrt((placedMarkers.upper_right_lateral.x - placedMarkers.upper_left_lateral.x) ** 2 + (placedMarkers.upper_right_lateral.y - placedMarkers.upper_left_lateral.y) ** 2))}
                      y2={(placedMarkers.upper_left_lateral.y + placedMarkers.upper_right_lateral.y) / 2 + 100 * ((placedMarkers.upper_right_lateral.x - placedMarkers.upper_left_lateral.x) / Math.sqrt((placedMarkers.upper_right_lateral.x - placedMarkers.upper_left_lateral.x) ** 2 + (placedMarkers.upper_right_lateral.y - placedMarkers.upper_left_lateral.y) ** 2))}
                      stroke="#000000"
                      strokeWidth="1"
                      strokeDasharray="5 5"
                    />
                  </>
                )}
              </svg>

              {arActive && currentMarkerPlacement && (
                <div className="absolute bottom-2 left-2 right-2 bg-blue-100 text-blue-800 p-2 rounded text-center text-sm shadow">
                  Tap on: <strong>{markerSequence.find(m => m.id === currentMarkerPlacement)?.name}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h3 className="text-lg font-semibold text-green-600 mb-4">Placement Progress</h3>
            <ul className="space-y-2">
              {markerSequence.map((m) => (
                <li key={m.id} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${placedMarkers[m.id] ? 'bg-green-500' : currentMarkerPlacement === m.id ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-sm">{m.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {measurements && (
          <div className="bg-white mt-6 rounded-2xl shadow-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Midline Measurements</h3>
            <p className="text-sm">Upper Angle: <strong>{measurements.upperAngle}°</strong></p>
            <p className="text-sm">Lower Angle: <strong>{measurements.lowerAngle}°</strong></p>
            <p className={`text-sm ${parseFloat(measurements.midlineDeviation) > 3 ? 'text-red-600' : 'text-green-600'}`}>
              Midline Deviation: <strong>{measurements.midlineDeviation}°</strong>
            </p>
          </div>
        )}

        <div className="bg-white mt-6 rounded-2xl shadow-lg p-4 text-center">
          <button
            onClick={exportResults}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm inline-flex items-center"
            disabled={!measurements}
          >
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </button>
          <p className="text-xs text-gray-400 mt-2">Exports current midline measurement with screenshot</p>
        </div>
      </div>
    </div>
  );
};

export default MetaOrthoAndroid;