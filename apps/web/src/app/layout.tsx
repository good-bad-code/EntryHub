import { AuthProvider } from '../infrastructure/auth/AuthContext';
import { ThemeProvider } from '../infrastructure/theme/ThemeContext';

export const metadata = {
  title: 'Entry-Hub | 엔트리 에셋 공유 및 주입 플랫폼',
  description: '엔트리 블록 코드, 오브젝트, 장면 에셋을 탐색하고 내 작품으로 불러오세요.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
