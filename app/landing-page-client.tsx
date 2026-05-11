'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isLandingAutoConfirmWindow } from '@/lib/subscription';

const LANDING_LOGO_URL = '/assets/grobet-logo.png';
const SAMPLE_BRIEFING_PATH = '/w/6';
const LATEST_ISSUE_PATH = '/sample-issue';

type LandingPageClientProps = {
  initialArchivePrompt: boolean;
};

export default function LandingPageClient({
  initialArchivePrompt,
}: LandingPageClientProps) {
  const autoConfirmActive = isLandingAutoConfirmWindow();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    initialArchivePrompt ? 'success' : 'idle'
  );
  const [message, setMessage] = useState(
    initialArchivePrompt
      ? autoConfirmActive
        ? 'Subscribe first to access the archive. You will get instant access in this browser.'
        : 'Subscribe first to access the archive. Then confirm your email in this browser.'
      : ''
  );
  const [showLandingLogo, setShowLandingLogo] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data?.status === 'auto_confirmed') {
          const archiveUrl =
            typeof data.archive_url === 'string' && data.archive_url.length > 0
              ? data.archive_url
              : '/issues';
          window.location.assign(archiveUrl);
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Check your inbox to confirm.');
        setEmail('');
        setName('');
      } else {
        setStatus('error');
        setMessage(data.message || data.error || 'Something went wrong.');
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
        color: '#1a1a1a',
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
            letterSpacing: 1,
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
              left: 0,
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
            marginBottom: 10,
          }}
        >
          Monday morning briefing
        </div>
        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 52,
            margin: '0 0 16px',
            fontWeight: 500,
            color: '#173404',
            letterSpacing: -1,
            lineHeight: 1.05,
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
            marginBottom: 0,
          }}
        >
          The clearest weekly signal on how AI is changing Indian farming, forestry, agroforestry and ecology
          {' — '}curated for growers, researchers, students and land-sector builders.
        </p>
      </div>

      <div
        style={{
          background: '#FBF9F2',
          border: '0.5px solid #C0DD97',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 40,
        }}
      >
        <p style={{ fontSize: 15, margin: '0 0 20px', lineHeight: 1.65, color: '#2C2C2A' }}>
          Every Monday morning, a short briefing lands in your inbox with the week&apos;s most important AI moves across
          agriculture, forestry, biodiversity and ecology {'— '}with special attention to India and Indian growers.
          Written and edited by Mallesh Lingachar, Director of Grobet India Agrotech.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#fff',
              border: '0.5px solid #C0DD97',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#2C2C2A',
            }}
          >
            <strong style={{ color: '#173404', fontWeight: 600 }}>Every issue includes:</strong>
            <br />
            3 big signals, 1 India move, 1 field or research use case, and 1 opportunity.
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#fff',
              border: '0.5px solid #C0DD97',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#2C2C2A',
            }}
          >
            <strong style={{ color: '#173404', fontWeight: 600 }}>Built for:</strong>
            <br />
            Farmers, foresters, agri students, startup teams, and policy professionals.
          </div>
        </div>
        <p style={{ fontSize: 14, margin: '0 0 16px', lineHeight: 1.65, color: '#5F5E5A' }}>
          Free forever. No advertising. Instant archive access after signup.{' '}
          <Link href="/unsubscribe" style={{ color: '#3B6D11', textDecoration: 'underline' }}>
            Unsubscribe in one click.
          </Link>
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
                fontFamily: 'inherit',
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
                fontFamily: 'inherit',
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
              fontFamily: 'inherit',
            }}
          >
            {status === 'loading' ? 'Subscribing…' : 'Get Monday Briefing'}
          </button>
        </form>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: '#6B7280',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          One email every Monday. No ads. Leave anytime.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            marginTop: 18,
          }}
        >
          <Link
            href={LATEST_ISSUE_PATH}
            style={{
              display: 'block',
              padding: '14px 16px',
              borderRadius: 8,
              border: '0.5px solid #C0DD97',
              background: '#fff',
              color: '#173404',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Read the latest issue</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              Open a public sample of the newest Monday briefing before subscribing.
            </div>
          </Link>
          <Link
            href={SAMPLE_BRIEFING_PATH}
            style={{
              display: 'block',
              padding: '14px 16px',
              borderRadius: 8,
              border: '0.5px solid #C0DD97',
              background: '#fff',
              color: '#173404',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>See a sample Monday briefing</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              Preview the public WhatsApp issue hub before subscribing.
            </div>
          </Link>
        </div>

        {status === 'success' && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: '#EAF3DE',
              color: '#173404',
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}
        {status === 'error' && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: '#FCEBEB',
              color: '#791F1F',
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 24 }}>
        <p>
          <strong style={{ fontWeight: 500, color: '#173404' }}>What you&apos;ll read about:</strong> India&apos;s AI policy shifts,
          crop and field pilots, forestry and biodiversity tools, research benchmarks, startup launches, and live
          opportunities for Indian agriculture students and researchers.
        </p>
        <p>
          <strong style={{ fontWeight: 500, color: '#173404' }}>Who it&apos;s for:</strong> Farmers and agroforestry growers,
          forest department officers, agriculture faculty and students, startup operators, policy makers, and anyone
          who wants signal over hype in AI for the land sector.
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
          textAlign: 'center',
        }}
      >
        Published by Grobet India Agrotech Pvt Ltd (CIN U62090KA2023PTC170106) {'· '}Bengaluru, India
        <br />
        In service of the Sandalwood Intelligence Platform community
        <br />
        <Link href="/unsubscribe" style={{ color: '#3B6D11', textDecoration: 'underline' }}>
          Manage subscription or unsubscribe
        </Link>
      </footer>
    </main>
  );
}
