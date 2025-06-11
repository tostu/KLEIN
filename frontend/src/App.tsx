import React, { useState } from "react";
import "./App.css";

function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [convertedImages, setConvertedImages] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [networkMetrics, setNetworkMetrics] = useState({});
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);

  // Configure your Hono backend URL
  const HONO_BASE_URL = import.meta.env.VITE_HONO_BASE_URL;

  const supportedFormats = [
    { extension: "jpeg", mimeType: "image/jpeg", quality: 0.9 },
    { extension: "png", mimeType: "image/png" },
    { extension: "webp", mimeType: "image/webp", quality: 0.9 },
    { extension: "bmp", mimeType: "image/bmp" },
    { extension: "avif", mimeType: "image/avif" },
  ];

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsConverting(true);
    setOriginalImage({
      url: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      file: file,
    });

    try {
      const conversions = await convertToFormats(file);
      setConvertedImages(conversions);
    } catch (error) {
      console.error("Conversion failed:", error);
    } finally {
      setIsConverting(false);
    }
  };

  const convertToFormats = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const conversions = {};

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

  // Updated function to use Hono backend instead of Uguu
  const uploadToHono = async (blob, filename) => {
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

      const data = await response.json();

      // Hono returns the same format as Uguu for compatibility
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

  // Updated function to download from Hono backend
  const downloadFromHono = async (url) => {
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

  const measureNetworkPerformance = async (format, imageData) => {
    const startTime = performance.now();
    let uploadTime, downloadTime, totalTime;

    try {
      // Upload phase - now using Hono
      const uploadStart = performance.now();
      const honoData = await uploadToHono(
        imageData.blob,
        `converted_image.${format}`,
      );
      uploadTime = performance.now() - uploadStart;

      // Download phase - now using Hono
      const downloadStart = performance.now();
      await downloadFromHono(honoData.url);
      downloadTime = performance.now() - downloadStart;

      totalTime = performance.now() - startTime;

      return {
        uploadTime: uploadTime.toFixed(2),
        downloadTime: downloadTime.toFixed(2),
        totalTime: totalTime.toFixed(2),
        imageSize: imageData.size,
        honoUrl: honoData.url,
        success: true,
      };
    } catch (error) {
      console.error(`Network test failed for ${format}:`, error);
      return {
        error: error.message,
        success: false,
      };
    }
  };

  const testNetworkPerformance = async () => {
    if (!convertedImages || Object.keys(convertedImages).length === 0) {
      alert(
        "Please convert an image first before testing network performance.",
      );
      return;
    }

    setIsTestingNetwork(true);
    const metrics = {};

    // Test original image first
    if (originalImage?.file) {
      try {
        const originalMetrics = await measureNetworkPerformance("original", {
          blob: originalImage.file,
          size: originalImage.size,
        });
        metrics.original = originalMetrics;
      } catch (error) {
        metrics.original = { error: error.message, success: false };
      }
    }

    // Test each converted format
    for (const [format, imageData] of Object.entries(convertedImages)) {
      try {
        const formatMetrics = await measureNetworkPerformance(
          format,
          imageData,
        );
        metrics[format] = formatMetrics;
      } catch (error) {
        metrics[format] = { error: error.message, success: false };
      }
    }

    setNetworkMetrics(metrics);
    setIsTestingNetwork(false);
  };

  const downloadImage = (dataUrl, filename, extension) => {
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
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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
              Using Hono Backend at: {HONO_BASE_URL}
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
                Convert your image to multiple formats and test network
                performance using Hono backend
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
                Image Conversion & Network Testing
              </h2>
              <div className="space-x-3">
                {Object.keys(convertedImages).length > 0 && (
                  <button
                    className={`px-4 py-2 rounded-lg font-medium ${
                      isTestingNetwork
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600"
                    } text-white`}
                    onClick={testNetworkPerformance}
                    disabled={isTestingNetwork}
                  >
                    {isTestingNetwork
                      ? "Testing..."
                      : "Test Network Performance"}
                  </button>
                )}
                <button
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  onClick={resetUpload}
                >
                  Upload New Image
                </button>
              </div>
            </div>

            {isConverting ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-4 text-lg">Converting image...</span>
              </div>
            ) : (
              <>
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
                        Original
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          ORIGINAL
                        </span>
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {originalImage.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        Size: {originalImage.size}
                      </p>
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
                        <h3 className="font-semibold text-sm flex items-center">
                          {format.toUpperCase()}
                          <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            CONVERTED
                          </span>
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          Size: {data.size}
                        </p>
                        <button
                          className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          onClick={() =>
                            downloadImage(data.url, originalImage.name, format)
                          }
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Network Performance Results */}
                {Object.keys(networkMetrics).length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">
                      Network Performance Results (Hono Backend)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
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
                                  {metrics.success
                                    ? formatTime(metrics.uploadTime)
                                    : "Failed"}
                                </td>
                                <td className="py-2">
                                  {metrics.success
                                    ? formatTime(metrics.downloadTime)
                                    : "Failed"}
                                </td>
                                <td className="py-2">
                                  {metrics.success
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

                    {isTestingNetwork && (
                      <div className="mt-4 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="ml-2 text-sm text-gray-600">
                          Testing network performance...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-200 text-center py-4 text-sm text-gray-600">
        <p>
          Copyright © {new Date().getFullYear()} - Network Performance Testing
          Tool (Hono Backend)
        </p>
      </footer>
    </div>
  );
}

export default App;
