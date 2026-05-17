import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Genesis-1</h1>
      <p className="text-lg text-gray-600 mb-8">AI-Powered Software Architecture Platform</p>
      <div className="flex gap-4">
        <Link href="/login" className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
          Login
        </Link>
        <Link href="/register" className="rounded-lg border border-gray-300 px-6 py-2 hover:bg-gray-100">
          Register
        </Link>
        <Link href="/dashboard" className="rounded-lg border border-gray-300 px-6 py-2 hover:bg-gray-100">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
