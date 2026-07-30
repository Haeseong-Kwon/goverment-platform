import { Suspense } from "react";
import Script from "next/script";
import { PageViewTracker } from "./PageViewTracker";

/**
 * 트래킹 스크립트 로더.
 *
 * 규칙 두 가지를 지킵니다.
 * 1) 환경변수가 없으면 아무 것도 넣지 않습니다. 로컬·프리뷰 통계가 실측에 섞이면 지표를 못 믿습니다.
 * 2) 광고용 저장소는 기본 거부(Consent Mode v2)로 시작합니다. 국내 개인정보보호법상
 *    행태정보 광고 활용에는 동의가 필요하므로, 동의 배너를 붙이기 전까지 켜지 않습니다.
 *    분석용 저장소만 허용하며 IP는 익명화합니다.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const NAVER_ANALYTICS_ID = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID?.trim();
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID?.trim();

/** 프로덕션에서만 계측합니다. 개발 중 클릭이 전환 수치를 오염시키지 않아야 합니다. */
const ENABLED = process.env.NODE_ENV === "production";

export function Analytics() {
  if (!ENABLED) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script
            id="ga-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: 'granted'
              });
              gtag('config', '${GA_ID}', {
                anonymize_ip: true,
                send_page_view: true
              });
            `}
          </Script>
          {/* useSearchParams는 Suspense 경계가 필요합니다. 없으면 정적 렌더링이 깨집니다. */}
          <Suspense fallback={null}>
            <PageViewTracker gaId={GA_ID} />
          </Suspense>
        </>
      )}

      {NAVER_ANALYTICS_ID && (
        <>
          <Script id="naver-wcslog" strategy="afterInteractive" src="//wcs.naver.net/wcslog.js" />
          <Script id="naver-wcs-init" strategy="afterInteractive">
            {`
              if (window.wcs) {
                window.wcs_add = window.wcs_add || {};
                window.wcs_add['wa'] = '${NAVER_ANALYTICS_ID}';
                if (window.wcs.inflow) window.wcs.inflow();
                window.wcs_do();
              }
            `}
          </Script>
        </>
      )}

      {CLARITY_ID && (
        <Script id="clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");
          `}
        </Script>
      )}
    </>
  );
}
