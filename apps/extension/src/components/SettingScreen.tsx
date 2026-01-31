
import { useState, useEffect } from 'react';
import { syncEmails, updateModelPreference, syncModelPreference, getAvailableModels, type AIModel } from '../services/api.js';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function SettingScreen() {
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Load available models and user preference on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        // 1. Fetch available models from backend
        const availableModels = await getAvailableModels();
        setModels(availableModels);

        // 2. Check local storage for user's selection
        const result = await chrome.storage.local.get(['selectedModel']);
        if (result.selectedModel) {
          setSelectedModel(result.selectedModel);
        } else {
          // 3. Use default model from the list or first available
          const defaultModel = availableModels.find(m => m.isDefault);
          const fallbackModel = defaultModel?.modelId || availableModels[0]?.modelId || '';
          setSelectedModel(fallbackModel);
        }

        // 4. Sync from backend to ensure latest cross-device setting
        await syncModelPreference();
        const updated = await chrome.storage.local.get(['selectedModel']);
        if (updated.selectedModel) {
          setSelectedModel(updated.selectedModel);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);

    // 1. Save locally immediately
    chrome.storage.local.set({ selectedModel: newModel }, () => {
      console.log('Model saved locally:', newModel);
    });

    // 2. Sync to backend
    try {
      await updateModelPreference(newModel);
      console.log('Model synced to backend:', newModel);
    } catch (error) {
      console.error('Failed to sync model to backend:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus({ message: 'Syncing latest emails...', type: 'loading' });
    try {
      const result = await syncEmails();
      setSyncStatus({ message: result.message, type: 'success' });
    } catch (err: any) {
      setSyncStatus({ message: err.message || 'Failed to sync.', type: 'error' });
    } finally {
      setIsSyncing(false);
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSyncStatus(prev => prev?.type === 'success' ? null : prev);
      }, 3000);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#121212] text-white p-6">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="w-full max-w-sm space-y-6">
        {/* Model Selection */}
        <div className="bg-[#1E1E1E] p-4 rounded-lg border border-gray-800">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            AI Model
          </label>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading models...
            </div>
          ) : models.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">
              No models available. Please contact support.
            </div>
          ) : (
            <select
              value={selectedModel}
              onChange={handleModelChange}
              className="w-full bg-[#2C2C2C] text-white border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#31B8C6]"
            >
              {models.map((model) => (
                <option key={model.modelId} value={model.modelId}>
                  {model.displayName}
                  {model.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Select the AI model used for summaries and chat.
          </p>
        </div>

        {/* Sync Button */}
        <div className="bg-[#1E1E1E] p-4 rounded-lg border border-gray-800 text-center">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Data Sync</h2>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`w-full border-2 border-[#31B8C6] text-[#31B8C6] px-4 py-2 rounded-md font-medium transition-all duration-300 hover:bg-[#31B8C6] hover:text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isSyncing && <RefreshCw className="w-4 h-4 animate-spin" />}
            {isSyncing ? 'Syncing...' : 'Sync Latest 5 Emails'}
          </button>

          {/* Status Indicator */}
          {syncStatus && (
            <div className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-medium animate-in fade-in slide-in-from-top-1 ${syncStatus.type === 'success' ? 'text-emerald-500' :
              syncStatus.type === 'error' ? 'text-red-400' : 'text-[#22d3ee]'
              }`}>
              {syncStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                syncStatus.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : null}
              {syncStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingScreen;
