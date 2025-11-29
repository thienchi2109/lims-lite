import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Hệ thống Quản lý Thông tin Phòng Xét nghiệm
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            CDC LIMS-Lite
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto">
              Đăng nhập
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
