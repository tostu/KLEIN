import { formatTime } from "../helper/FormatTime";
import type { NetworkMetricsMap } from "./NetworkMetricsDisplay";

export const SummaryTable = (networkMetrics: NetworkMetricsMap) => {
  return (
    <>
      {Object.keys(networkMetrics).length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-600">
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
                {Object.entries(networkMetrics)
                  .slice(1)
                  .map(([format, metrics]) => (
                    <tr key={format} className="border-b">
                      <td className="py-2 font-medium">
                        {format.toUpperCase()}
                      </td>
                      <td className="py-2">{metrics.imageSize || "N/A"}</td>
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
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}{" "}
    </>
  );
};
