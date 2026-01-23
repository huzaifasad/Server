'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Store, Plus, X } from 'lucide-react';
// import { useToast } from '@/hooks/use-toast';
import { Toaster} from 'react-hot-toast';

const DEFAULT_STORES = [
  { name: 'French Connection', url: 'https://www.frenchconnection.com', active: true },
  { name: 'Allbirds', url: 'https://www.allbirds.com', active: false },
];

export default function ShopifyStoreManager() {
  const [stores, setStores] = useState([]);
  const [storeUrl, setStoreUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isShopify, setIsShopify] = useState(null);
  const [storeName, setStoreName] = useState('');
//   const { toast } = useToast();

  useEffect(() => {
    const savedStores = localStorage.getItem('shopify_stores');
    if (savedStores) {
      setStores(JSON.parse(savedStores));
    } else {
      setStores(DEFAULT_STORES);
      localStorage.setItem('shopify_stores', JSON.stringify(DEFAULT_STORES));
    }
  }, []);

  const checkShopifyStore = async () => {
    if (!storeUrl) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a store URL',
      });
      return;
    }

    setIsChecking(true);
    setIsShopify(null);
    setStoreName('');

    try {
      const url = new URL(storeUrl);
      
      let isShopifyStore = url.hostname.includes('.myshopify.com') || 
                           url.hostname.includes('myshopify.com');
      
      if (!isShopifyStore) {
        try {
          const testUrl = url.origin + '/products.json?limit=1';
          const response = await fetch(testUrl);
          if (response.ok) {
            const data = await response.json();
            if (data && data.products) {
              isShopifyStore = true;
            }
          }
        } catch (e) {
          console.log('Could not verify via products.json');
        }
      }

      setIsShopify(isShopifyStore);

      if (isShopifyStore) {
        const hostname = url.hostname.replace('www.', '');
        const name = hostname.split('.')[0];
        setStoreName(name.charAt(0).toUpperCase() + name.slice(1));
        
        toast({
          title: 'Shopify Store Detected! ✓',
          description: 'This is a valid Shopify store. You can add it now.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Not a Shopify Store',
          description: 'Sorry, this store is not using Shopify platform.',
        });
      }
    } catch (err) {
      setIsShopify(false);
      toast({
        variant: 'destructive',
        title: 'Invalid URL',
        description: 'Please enter a valid URL (e.g., https://example.com)',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const addStore = () => {
    if (!storeName || !storeUrl) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please check the store first',
      });
      return;
    }

    try {
      const url = new URL(storeUrl);
      const newStore = {
        name: storeName,
        url: url.origin,
        active: false,
      };

      const updatedStores = [...stores, newStore];
      setStores(updatedStores);
      localStorage.setItem('shopify_stores', JSON.stringify(updatedStores));

      toast({
        title: 'Store Added Successfully!',
        description: `${storeName} has been added to your store list.`,
      });

      setStoreUrl('');
      setStoreName('');
      setIsShopify(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add store',
      });
    }
  };

  const removeStore = (index) => {
    const updatedStores = stores.filter((_, i) => i !== index);
    setStores(updatedStores);
    localStorage.setItem('shopify_stores', JSON.stringify(updatedStores));
    
    toast({
      title: 'Store Removed',
      description: 'Store has been removed from your list.',
    });
  };

  const toggleActive = (index) => {
    const updatedStores = stores.map((store, i) => ({
      ...store,
      active: i === index ? !store.active : store.active,
    }));
    setStores(updatedStores);
    localStorage.setItem('shopify_stores', JSON.stringify(updatedStores));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Store className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800">Shopify Store Manager</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Store URL
              </label>
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                onKeyPress={(e) => e.key === 'Enter' && checkShopifyStore()}
              />
            </div>

            {storeName && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Store Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={checkShopifyStore}
                disabled={isChecking || !storeUrl}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Check Store
                  </>
                )}
              </button>

              {isShopify === true && (
                <button
                  onClick={addStore}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add Store
                </button>
              )}
            </div>

            {isShopify !== null && (
              <div className={`p-4 rounded-lg ${isShopify ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${isShopify ? 'text-green-800' : 'text-red-800'}`}>
                  {isShopify 
                    ? '✓ Valid Shopify store detected!' 
                    : '✗ This is not a Shopify store'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Your Stores</h2>
          
          {stores.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No stores added yet</p>
          ) : (
            <div className="space-y-3">
              {stores.map((store, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={store.active}
                      onChange={() => toggleActive(index)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <h3 className="font-semibold text-slate-800">{store.name}</h3>
                      <a 
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {store.url}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => removeStore(index)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Toaster />
    </div>
  );
}