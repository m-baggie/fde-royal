import { useState, useEffect } from 'react';
import BrowsePage from './pages/BrowsePage';

export default function App() {
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <BrowsePage
        isUploadOpen={uploadOpen}
        onUploadClick={() => setUploadOpen(true)}
        onUploadRequestClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
