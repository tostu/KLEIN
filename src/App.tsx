import React, { useState } from "react";
import "./App.css";

function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [convertedImages, setConvertedImages] = useState({});
  const [isConverting, setIsConverting] = useState(false);

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
            // Estimate size from base64 string
            const base64Length = dataUrl.split(",")[1].length;
            const sizeInBytes = base64Length * 0.75;

            conversions[format.extension] = {
              url: dataUrl,
              size: (sizeInBytes / 1024).toFixed(1) + " KB",
              mimeType: format.mimeType,
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
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="min-h-screen flex flex-col w-screen">
      <header>
        <div className="navbar bg-base-100 shadow-sm">
          <a className="btn btn-ghost text-xl font-bitter">KLEIN</a>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-0">
        <div className="py-8">
          {!originalImage ? (
            <div className="max-w-sm mx-auto">
              <div className="form-control w-full">
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body items-center text-center">
                    <h2 className="card-title">Upload Image</h2>
                    <p className="text-base-content/60">
                      Convert your image to multiple formats
                    </p>
                    <button
                      className="btn btn-primary btn-wide mt-4"
                      onClick={() =>
                        document.getElementById("file-input")?.click()
                      }
                    >
                      Choose Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Image Conversion Results</h2>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={resetUpload}
                >
                  Upload New Image
                </button>
              </div>

              {isConverting ? (
                <div className="flex justify-center items-center py-12">
                  <div className="loading loading-spinner loading-lg"></div>
                  <span className="ml-4 text-lg">Converting image...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Original Image */}
                  <div className="card bg-base-100 shadow-xl">
                    <figure className="px-4 pt-4">
                      <img
                        src={originalImage.url}
                        alt="Original"
                        className="max-w-full h-48 object-contain rounded-lg"
                      />
                    </figure>
                    <div className="card-body">
                      <h3 className="card-title text-sm">
                        Original
                        <div className="badge badge-primary badge-sm">
                          ORIGINAL
                        </div>
                      </h3>
                      <p className="text-xs text-base-content/60">
                        {originalImage.name}
                      </p>
                      <p className="text-xs text-base-content/60">
                        Size: {originalImage.size}
                      </p>
                    </div>
                  </div>

                  {/* Converted Images */}
                  {Object.entries(convertedImages).map(([format, data]) => (
                    <div key={format} className="card bg-base-100 shadow-xl">
                      <figure className="px-4 pt-4">
                        <img
                          src={data.url}
                          alt={`${format.toUpperCase()} version`}
                          className="max-w-full h-48 object-contain rounded-lg"
                        />
                      </figure>
                      <div className="card-body">
                        <h3 className="card-title text-sm">
                          {format.toUpperCase()}
                          <div className="badge badge-secondary badge-sm">
                            CONVERTED
                          </div>
                        </h3>
                        <p className="text-xs text-base-content/60">
                          Size: {data.size}
                        </p>
                        <div className="card-actions justify-end mt-2">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              downloadImage(
                                data.url,
                                originalImage.name,
                                format,
                              )
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
            </div>
          )}
        </div>
      </main>

      <footer className="footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4">
        <aside>
          <p>
            Copyright © {new Date().getFullYear()} - All right reserved by ACME
            Industries Ltd
          </p>
        </aside>
      </footer>
    </div>
  );
}

export default App;
