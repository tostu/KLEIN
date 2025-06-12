import { formatTime } from "../helper/FormatTime";

export interface NetworkMetrics {
  uploadTime?: string;
  downloadTime?: string;
  totalTime?: string;
  imageSize?: string;
  honoUrl?: string;
  success: boolean;
  error?: string;
}

export interface NetworkMetricsMap {
  [key: string]: NetworkMetrics;
}

interface NetworkMetricsDisplayProps {
  format: string;
  metrics?: NetworkMetrics;
  isTesting?: boolean;
}

export const NetworkMetricsDisplay = ({
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
