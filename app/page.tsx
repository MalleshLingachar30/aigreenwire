'use client';

import { useState } from 'react';
import Link from 'next/link';

const LANDING_LOGO_URL = '/assets/grobet-logo.png';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showLandingLogo, setShowLandingLogo] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Check your inbox to confirm.');
        setEmail('');
        setName('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <main
      style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a1a'
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#173404',
            color: '#C0DD97',
            position: 'relative',
            textAlign: 'center',
            lineHeight: '44px',
            fontWeight: 500,
            fontSize: 14,
            overflow: 'hidden',
            letterSpacing: 1
          }}
        >
          GB
          <img
            src={LANDING_LOGO_URL}
            alt="Grow Better India"
            width={44}
            height={44}
            onError={() => setShowLandingLogo(false)}
            style={{
              display: showLandingLogo ? 'block' : 'none',
              width: '44px',
              height: '44px',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#173404' }}>Grow Better India</div>
          <div style={{ fontSize: 11, color: '#888780', letterSpacing: 1, textTransform: 'uppercase' }}>
            Sandalwood Intelligence
          </div>
        </div>
      </header>

      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: '#3B6D11',
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: 10
          }}
        >
          A weekly briefing
        </div>
        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 52,
            margin: '0 0 16px',
            fontWeight: 500,
            color: '#173404',
            letterSpacing: -1,
            lineHeight: 1.05
          }}
        >
          The AI Green Wire
        </h1>
        <p
          style={{
            fontSize: 17,
            color: '#5F5E5A',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.5,
            marginBottom: 0
          }}
        >
          What changed this week in AI for agriculture, agroforestry, forestry, biodiversity and the natural world
          {' — '}curated for growers, foresters and students.
        </p>
      </div>

      <div style={{ background: '#FBF9F2', border: '0.5px solid #C0DD97', borderRadius: 12, padding: '24px 28px', marginBottom: 40 }}>
        <p style={{ fontSize: 15, margin: '0 0 20px', lineHeight: 1.65, color: '#2C2C2A' }}>
          Every Monday morning, a two-page briefing lands in your inbox covering the week&apos;s most important
          developments in AI applied to farming, forestry and ecology {'— '}with special attention to India and Indian
          growers. Written and edited by Mallesh Lingachar, Executive Director - Grobet India Agrotech|AI Industry
          Speciallist | Certified Sandalwood Trainer| Ex Board Member-Institute of Agroforestry Farmers &
          Technologists| Associate - Global Green Growth.
        </p>
        <p style={{ fontSize: 14, margin: '0 0 20px', lineHeight: 1.65, color: '#5F5E5A' }}>
          Free forever. No advertising. Unsubscribe in one click.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 15,
                border: '0.5px solid #C0DD97',
                borderRadius: 8,
                background: '#fff',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 15,
                border: '0.5px solid #C0DD97',
                borderRadius: 8,
                background: '#fff',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 15,
              fontWeight: 500,
              background: '#173404',
              color: '#C0DD97',
              border: 'none',
              borderRadius: 8,
              cursor: status === 'loading' ? 'wait' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>

        {status === 'success' && (
          <div
            style={{ marginTop: 14, padding: '10px 14px', background: '#EAF3DE', color: '#173404', borderRadius: 6, fontSize: 14 }}
          >
            {message}
          </div>
        )}
        {status === 'error' && (
          <div
            style={{ marginTop: 14, padding: '10px 14px', background: '#FCEBEB', color: '#791F1F', borderRadius: 6, fontSize: 14 }}
          >
            {message}
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 24 }}>
        <p>
          <strong style={{ fontWeight: 500, color: '#173404' }}>What you&apos;ll read about:</strong> India&apos;s AI policy shifts
          (Bharat-VISTAAR, AI Centres of Excellence), state-level pilots from Telangana to Maharashtra, global
          developments in AI forest monitoring and carbon accounting, biodiversity AI research from FAO to Google, and
          live opportunities for Indian agriculture students and researchers.
        </p>
        <p>
          <strong style={{ fontWeight: 500, color: '#173404' }}>Who it&apos;s for:</strong> Farmers and agroforestry growers,
          forest department officers, agriculture university faculty and students, policy makers, and anyone who
          believes AI will reshape how we work the land.
        </p>
      </div>

      <Link href="/issues" style={{ display: 'inline-block', fontSize: 14, color: '#3B6D11', textDecoration: 'none', marginBottom: 32 }}>
        Browse the archive →
      </Link>

      <footer
        style={{
          borderTop: '0.5px solid #C0DD97',
          paddingTop: 16,
          fontSize: 11,
          color: '#888780',
          lineHeight: 1.6,
          textAlign: 'center'
        }}
      >
        Published by Grobet India Agrotech Pvt Ltd (CIN U62090KA2023PTC170106) {'· '}Bengaluru, India
        <br />
        In service of the Sandalwood Intelligence Platform community
      </footer>
    </main>
  );
}
