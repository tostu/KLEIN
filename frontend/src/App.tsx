import { useState } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

interface OriginalImage {
  url: string;
  name: string;
  size: string;
  file: File;
}

interface ConvertedImageData {
  url: string;
  size: string;
  mimeType: string;
  blob: Blob;
}

interface ConvertedImages {
  [key: string]: ConvertedImageData;
}

interface NetworkMetrics {
  uploadTime?: string;
  downloadTime?: string;
  totalTime?: string;
  imageSize?: string;
  honoUrl?: string;
  success: boolean;
  error?: string;
}

interface NetworkMetricsMap {
  [key: string]: NetworkMetrics;
}

interface IsTestingNetworkMap {
  [key: string]: boolean;
}

interface SupportedFormat {
  extension: string;
  mimeType: string;
  quality?: number;
}

interface UploadResponse {
  files: Array<{ url: string }>;
}

interface NetworkMetricsDisplayProps {
  format: string;
  metrics?: NetworkMetrics;
  isTesting?: boolean;
}

function App() {
  const [originalImage, setOriginalImage] = useState<OriginalImage | null>(
    null,
  );
  const [convertedImages, setConvertedImages] = useState<ConvertedImages>({});
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetricsMap>({});
  const [isTestingNetwork, setIsTestingNetwork] = useState<IsTestingNetworkMap>(
    {},
  );

  // Configure your Hono backend URL
  const HONO_BASE_URL = import.meta.env.VITE_HONO_BASE_URL as string;

  const supportedFormats: SupportedFormat[] = [
    { extension: "jpeg", mimeType: "image/jpeg", quality: 0.9 },
    { extension: "png", mimeType: "image/png" },
    { extension: "webp", mimeType: "image/webp", quality: 0.9 },
    { extension: "bmp", mimeType: "image/bmp" },
    { extension: "avif", mimeType: "image/avif" },
  ];

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsConverting(true);
    setNetworkMetrics({});
    setIsTestingNetwork({});

    setOriginalImage({
      url: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      file: file,
    });

    try {
      const conversions = await convertToFormats(file);
      setConvertedImages(conversions);

      // Start network performance testing immediately after conversion
      setTimeout(() => {
        testAllNetworkPerformance(file, conversions);
      }, 100);
    } catch (error) {
      console.error("Conversion failed:", error);
    } finally {
      setIsConverting(false);
    }
  };

  const convertToFormats = (file: File): Promise<ConvertedImages> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        if (!ctx) return;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const conversions: ConvertedImages = {};

        supportedFormats.forEach((format) => {
          try {
            const dataUrl = canvas.toDataURL(format.mimeType, format.quality);
            const base64Length = dataUrl.split(",")[1].length;
            const sizeInBytes = base64Length * 0.75;

            // Convert data URL to blob for upload
            const base64Data = dataUrl.split(",")[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: format.mimeType });

            conversions[format.extension] = {
              url: dataUrl,
              size: (sizeInBytes / 1024).toFixed(1) + " KB",
              mimeType: format.mimeType,
              blob: blob,
            };
          } catch (error) {
            console.warn(`Failed to convert to ${format.extension}:`, error);
          }
        });

        resolve(conversions);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const uploadToHono = async (
    blob: Blob,
    filename: string,
  ): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("files[]", blob, filename);

    try {
      const response = await fetch(`${HONO_BASE_URL}/upload`, {
        method: "POST",
        mode: "cors",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as UploadResponse;

      if (data.files && data.files.length > 0) {
        return { url: data.files[0].url };
      } else {
        throw new Error("Upload failed: No file URL returned");
      }
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const downloadFromHono = async (url: string): Promise<Blob> => {
    try {
      const response = await fetch(url, {
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} ${response.statusText}`,
        );
      }

      return response.blob();
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  };

  const measureNetworkPerformance = async (
    format: string,
    imageData: ConvertedImageData | { blob: File; size: string },
  ): Promise<NetworkMetrics> => {
    const startTime = performance.now();
    let uploadTime: number, downloadTime: number, totalTime: number;

    try {
      // Upload phase
      const uploadStart = performance.now();
      const honoData = await uploadToHono(
        imageData.blob,
        `converted_image.${format}`,
      );
      uploadTime = performance.now() - uploadStart;

      // Download phase
      const downloadStart = performance.now();
      await downloadFromHono(honoData.url);
      downloadTime = performance.now() - downloadStart;

      totalTime = performance.now() - startTime;

      return {
        uploadTime: uploadTime.toFixed(0),
        downloadTime: downloadTime.toFixed(0),
        totalTime: totalTime.toFixed(0),
        imageSize: imageData.size,
        honoUrl: honoData.url,
        success: true,
      };
    } catch (error) {
      console.error(`Network test failed for ${format}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        error: errorMessage,
        success: false,
      };
    }
  };

  const testAllNetworkPerformance = async (
    originalFile: File,
    conversions: ConvertedImages,
  ) => {
    // Test original image
    if (originalFile) {
      setIsTestingNetwork((prev) => ({ ...prev, original: true }));
      try {
        const originalMetrics = await measureNetworkPerformance("original", {
          blob: originalFile,
          size: (originalFile.size / 1024).toFixed(1) + " KB",
        });
        setNetworkMetrics((prev) => ({ ...prev, original: originalMetrics }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setNetworkMetrics((prev) => ({
          ...prev,
          original: { error: errorMessage, success: false },
        }));
      } finally {
        setIsTestingNetwork((prev) => ({ ...prev, original: false }));
      }
    }

    // Test each converted format
    for (const [format, imageData] of Object.entries(conversions)) {
      setIsTestingNetwork((prev) => ({ ...prev, [format]: true }));
      try {
        const formatMetrics = await measureNetworkPerformance(
          format,
          imageData,
        );
        setNetworkMetrics((prev) => ({ ...prev, [format]: formatMetrics }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setNetworkMetrics((prev) => ({
          ...prev,
          [format]: { error: errorMessage, success: false },
        }));
      } finally {
        setIsTestingNetwork((prev) => ({ ...prev, [format]: false }));
      }
    }
  };

  const downloadImage = (
    dataUrl: string,
    filename: string,
    extension: string,
  ) => {
    const link = document.createElement("a");
    link.download = `${filename.split(".")[0]}.${extension}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetUpload = () => {
    setOriginalImage(null);
    setConvertedImages({});
    setNetworkMetrics({});
    setIsTestingNetwork({});
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const formatTime = (ms: string | number) => {
    const msNum = typeof ms === "string" ? parseFloat(ms) : ms;
    if (msNum < 1000) return `${msNum}ms`;
    return `${(msNum / 1000).toFixed(1)}s`;
  };

  const NetworkMetricsDisplay = ({
    metrics,
    isTesting,
  }: NetworkMetricsDisplayProps) => {
    if (isTesting) {
      return (
        <div className="flex items-center mt-2">
          <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500 mr-2"></div>
          <span className="text-xs text-gray-500">Testing network...</span>
        </div>
      );
    }

    if (!metrics) {
      return (
        <div className="mt-2">
          <span className="text-xs text-gray-400">Network: Pending</span>
        </div>
      );
    }

    if (!metrics.success) {
      return (
        <div className="mt-2">
          <span className="text-xs text-red-500">Network: Failed</span>
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Upload:</span>
          <span className="font-medium text-blue-600">
            {metrics.uploadTime && formatTime(metrics.uploadTime)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Download:</span>
          <span className="font-medium text-green-600">
            {metrics.downloadTime && formatTime(metrics.downloadTime)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Total:</span>
          <span className="font-semibold text-purple-600">
            {metrics.totalTime && formatTime(metrics.totalTime)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col w-screen bg-gray-50">
      <header>
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-800 font-bitter">
              KLEIN
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real-time Image Conversion & Network Performance Testing
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {!originalImage ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
              <p className="text-gray-600 mb-6">
                Convert your image to multiple formats with automatic network
                performance testing
              </p>
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                Choose Image
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                Image Conversion & Network Performance
              </h2>
              <button
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                onClick={resetUpload}
              >
                Upload New Image
              </button>
            </div>

            {isConverting ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-4 text-lg">Converting image...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Original Image */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="p-4">
                    <img
                      src={originalImage.url}
                      alt="Original"
                      className="w-full h-48 object-contain rounded-lg"
                    />
                  </div>
                  <div className="p-4 border-t">
                    <h3 className="font-semibold text-sm flex items-center">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        ORIGINAL
                      </span>
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {originalImage.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      Size: {originalImage.size}
                    </p>
                    <NetworkMetricsDisplay
                      format="original"
                      metrics={networkMetrics.original}
                      isTesting={isTestingNetwork.original}
                    />
                  </div>
                </div>

                {/* Converted Images */}
                {Object.entries(convertedImages).map(([format, data]) => (
                  <div
                    key={format}
                    className="bg-white rounded-lg shadow-lg overflow-hidden"
                  >
                    <div className="p-4">
                      <img
                        src={data.url}
                        alt={`${format.toUpperCase()} version`}
                        className="w-full h-48 object-contain rounded-lg"
                      />
                    </div>
                    <div className="p-4 border-t">
                      <h3 className="font-semibold text-sm flex items-center text-neutral">
                        <span className="mr-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          CONVERTED
                        </span>
                        {format.toUpperCase()}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Size: {data.size}
                      </p>
                      <NetworkMetricsDisplay
                        format={format}
                        metrics={networkMetrics[format]}
                        isTesting={isTestingNetwork[format]}
                      />
                      <div className="mt-3">
                        <button
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          onClick={() =>
                            downloadImage(data.url, originalImage.name, format)
                          }
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary Table */}
            {Object.keys(networkMetrics).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">
                  Network Performance Summary
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-neutral">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Format</th>
                        <th className="text-left py-2">File Size</th>
                        <th className="text-left py-2">Upload Time</th>
                        <th className="text-left py-2">Download Time</th>
                        <th className="text-left py-2">Total Time</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(networkMetrics).map(
                        ([format, metrics]) => (
                          <tr key={format} className="border-b">
                            <td className="py-2 font-medium">
                              {format.toUpperCase()}
                            </td>
                            <td className="py-2">
                              {metrics.imageSize || "N/A"}
                            </td>
                            <td className="py-2">
                              {metrics.success && metrics.uploadTime
                                ? formatTime(metrics.uploadTime)
                                : "Failed"}
                            </td>
                            <td className="py-2">
                              {metrics.success && metrics.downloadTime
                                ? formatTime(metrics.downloadTime)
                                : "Failed"}
                            </td>
                            <td className="py-2">
                              {metrics.success && metrics.totalTime
                                ? formatTime(metrics.totalTime)
                                : "Failed"}
                            </td>
                            <td className="py-2">
                              {metrics.success ? (
                                <span className="text-green-600 font-medium">
                                  Success
                                </span>
                              ) : (
                                <span className="text-red-600 font-medium">
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-200 text-center py-4 text-sm text-gray-600">
        <p>
          Copyright © {new Date().getFullYear()} - Real-time Network
          Performance Testing
        </p>
      </footer>
    </div>
  );
}

export default App;
