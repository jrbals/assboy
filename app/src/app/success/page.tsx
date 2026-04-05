'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a0533',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
      padding: '20px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px',
        background: 'linear-gradient(135deg, #2d1155, #1a0533)',
        border: '3px solid #7BC74D',
        borderRadius: '25px',
        padding: '60px 40px',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
        <h1 style={{
          fontFamily: "'Bungee', cursive",
          fontSize: '2.5rem',
          color: '#7BC74D',
          marginBottom: '15px',
        }}>
          PURCHASE COMPLETE!
        </h1>
        <p style={{ color: '#c0a8e0', fontSize: '1.2rem', marginBottom: '30px', lineHeight: 1.6 }}>
          Your domain purchase is confirmed. We&apos;ll send transfer instructions to your email within 24 hours.
        </p>
        <p style={{ color: '#6a5080', fontSize: '0.9rem', marginBottom: '30px' }}>
          Session: {sessionId?.slice(0, 20)}...
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #FF3CAC, #9B30FF)',
            color: '#fff',
            fontFamily: "'Bungee', cursive",
            fontSize: '1.1rem',
            padding: '15px 40px',
            borderRadius: '40px',
            textDecoration: 'none',
          }}
        >
          BACK TO ASSBOY
        </a>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1a0533' }} />}>
      <SuccessContent />
    </Suspense>
  );
}
