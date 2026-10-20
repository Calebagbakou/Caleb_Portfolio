export function isLowDataNetwork() {
  if (typeof navigator === 'undefined') return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(
    connection
    && (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType)),
  );
}
