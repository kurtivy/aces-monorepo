// Force this page to be dynamic so middleware runs
export const dynamic = 'force-dynamic';

export default function TestMiddleware() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Middleware Test Page</h1>
      <p>Check the Network tab for middleware headers on this page.</p>
      <p>Look for:</p>
      <ul className="list-disc ml-6 mt-2">
        <li>x-middleware-test: working</li>
        <li>x-hostname: your-domain</li>
        <li>x-pathname: /test-middleware</li>
      </ul>
    </div>
  );
}
