export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test Page</h1>
      <p>If you can see this, Next.js is working!</p>
      <p className="mt-4">DATABASE_URL is set: {process.env.DATABASE_URL ? 'Yes ✅' : 'No ❌'}</p>
    </div>
  )
}

