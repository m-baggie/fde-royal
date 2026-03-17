import { useState } from 'react';
import Header from './components/Header';
import BrowsePage from './pages/BrowsePage';

export default function App() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <Header onUploadClick={() => setUploadOpen(true)} />
      <main style={{ paddingTop: '64px' }}>
        <BrowsePage
          isUploadOpen={uploadOpen}
          onUploadRequestClose={() => setUploadOpen(false)}
        />
      </main>
    </>
  );
}
