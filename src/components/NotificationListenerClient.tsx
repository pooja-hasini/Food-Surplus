'use client';
import React, { useState, useEffect } from 'react';
import NotificationListener from './NotificationListener';

type State = { error: Error | null };

class ListenerErrorBoundary extends React.Component<{ children?: React.ReactNode }, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		// You can log to a monitoring service here if desired
		console.warn('NotificationListener error caught:', error, info);
	}

	render() {
		if (this.state.error) {
			// Render fallback UI controlled by the client wrapper via props/state
			// We'll render a placeholder here and the client wrapper will show UI
			return <div data-listener-error="1" />;
		}
		return this.props.children as any;
	}
}

export default function NotificationListenerClient() {
	// local UI state shown when error occurs
	const [error, setError] = useState<Error | null>(null);
	const [showDetails, setShowDetails] = useState(false);

	// small helper: try to render listener inside the boundary and catch errors thrown synchronously
	// For async errors inside the listener (promises), rely on the boundary + the listener to surface them via thrown errors or rejections.
	return (
		<>
			{/* Error boundary will catch render-time errors; we also attach a minimal global catcher to surface unhandled ones */}
			<ListenerErrorBoundary>
				{/* The NotificationListener should throw errors or surface them via events; if it does, the boundary will show fallback */}
				<NotificationListener />
			</ListenerErrorBoundary>

			{/* Fallback UI: detect if the boundary produced an error element in the DOM and show details */}
			{/* Simple polling to detect boundary fallback without changing NotificationListener code */}
			{typeof window !== 'undefined' && (
				<ErrorInspector
					onError={(err) => {
						setError(err);
					}}
				/>
			)}

			{error && (
				<div
					role="alert"
					style={{
						position: 'fixed',
						right: 12,
						bottom: 12,
						maxWidth: 420,
						background: 'rgba(255,255,255,0.98)',
						border: '1px solid rgba(0,0,0,0.08)',
						padding: '12px',
						borderRadius: 8,
						boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
						zIndex: 9999,
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>Chat error</div>
					<div style={{ marginBottom: 8 }}>
						{error.message.startsWith('row') || /rls/i.test(error.message)
							? 'Sending failed due to database row-level security. Users may not be allowed to insert messages. Check server/API or DB RLS policies.'
							: error.message}
					</div>
					<div style={{ display: 'flex', gap: 8 }}>
						<button
							onClick={() => {
								// Retry by reloading the page — simpler and reliable for many auth/session issues
								window.location.reload();
							}}
						>
							Retry
						</button>
						<button
							onClick={() => {
								setShowDetails((s) => !s);
							}}
						>
							{showDetails ? 'Hide details' : 'Show details'}
						</button>
					</div>
					{showDetails && (
						<pre
							style={{
								whiteSpace: 'pre-wrap',
								background: '#f7f7f8',
								padding: 8,
								marginTop: 8,
								borderRadius: 6,
								fontSize: 12,
								maxHeight: 240,
								overflow: 'auto',
							}}
						>
							{String(error && (error.stack || error.message))}
						</pre>
					)}
				</div>
			)}
		</>
	);
}

/*
  Small helper component that watches for the error fallback marker inserted by ListenerErrorBoundary.
  If found, it reads the nearest error info from console (best-effort) and calls onError.
  This is a non-invasive way to detect the boundary fallback without editing NotificationListener.
*/
function ErrorInspector({ onError }: { onError: (err: Error) => void }) {
	useEffect(() => {
		let cancelled = false;
		const check = () => {
			if (cancelled) return;
			const el = document.querySelector('[data-listener-error="1"]');
			if (el) {
				// try to capture a recent error from window.__LAST_LISTENER_ERROR__ if available
				// (this is a best-effort, you can augment NotificationListener to call a global when it fails)
				// fallback: create a generic Error
				const globalErr = (window as any).__LAST_LISTENER_ERROR__ as Error | undefined;
				const err = globalErr || new Error('NotificationListener failed (see console for details)');
				onError(err);
			} else {
				// poll again shortly
				setTimeout(check, 300);
			}
		};
		check();
		return () => {
			cancelled = true;
		};
	}, [onError]);

	return null;
}
