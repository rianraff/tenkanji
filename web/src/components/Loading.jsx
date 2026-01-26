export default function Loading({ message = "Loading..." }) {
    return (
        <div className="loading-container" style={{ animation: 'scale-in 0.3s ease' }}>
            <div className="spinner"></div>
            <p style={{ fontWeight: '800', textTransform: 'uppercase', color: 'var(--col-black)', letterSpacing: '0.1em' }}>
                {message}
            </p>
        </div>
    );
}
