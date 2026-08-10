import { CATEGORIES, FLAG_CORRECT_CATEGORY, ITEM_FLAG_LABELS, POLICY } from "./ruleset";
import type { ExpenseInput, ExpenseVerdict, Finding, ItemFlag, ReasonCode, Severity } from "./types";

const DAY = 86_400_000;

const toTime = (value?: string) => {
  if (!value) return null;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(time) ? time : null;
};

const daysBetween = (from: number, to: number) => Math.round((to - from) / DAY);

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(Math.round(value))}원`;

class FindingCollector {
  private readonly items: Finding[] = [];
  private readonly missing: string[] = [];
  private readonly unknowns: string[] = [];

  add(finding: Finding) {
    this.items.push(finding);
  }

  /** 조건이 true일 때만 지적. 조건이 null/undefined면 "확인 필요"로 넘깁니다. */
  when(condition: boolean | null | undefined, label: string, finding: Finding) {
    if (condition === null || condition === undefined) {
      this.unknowns.push(label);
      return;
    }
    if (condition) this.add(finding);
  }

  missingEvidence(name: string) {
    this.missing.push(name);
  }

  unchecked(label: string) {
    this.unknowns.push(label);
  }

  result() {
    return { findings: [...this.items], missing: [...this.missing], unknowns: [...this.unknowns] };
  }
}

const rule = (
  code: string,
  severity: Severity,
  reasonCode: ReasonCode,
  message: string,
  clause: string,
  fix: string,
): Finding => ({ code, severity, reasonCode, message, clause, fix });

const hasFlag = (input: ExpenseInput, flag: ItemFlag) => (input.itemFlags ?? []).includes(flag);

/** 3-state 부정. 미입력은 null(확인 필요)로 유지합니다. */
const not = (value?: boolean | null) => (value === null || value === undefined ? null : !value);

function checkCommon(input: ExpenseInput, collect: FindingCollector) {
  const start = toTime(input.agreementStart);
  const end = toTime(input.agreementEnd);
  const execution = toTime(input.executionDate);

  if (start === null || end === null) {
    collect.unchecked("협약기간");
  } else if (execution === null) {
    collect.unchecked("집행일");
  } else if (execution < start || execution > end) {
    collect.add(
      rule(
        "COM-01",
        "block",
        "E-107",
        "집행일이 협약기간을 벗어났습니다.",
        "사업비는 협약기간 내에 집행이 완료되어야 함",
        `집행일을 협약기간(${input.agreementStart} ~ ${input.agreementEnd}) 내로 조정하거나, 기간 외 집행 사유를 주관기관과 협의하세요.`,
      ),
    );
  }

  if (input.amount <= 0) {
    collect.add(rule("COM-02", "block", "E-105", "집행 금액이 입력되지 않았습니다.", "정산 금액은 증빙 금액과 일치해야 함", "부가세 포함 실제 집행 금액을 입력하세요."));
  }

  if (hasFlag(input, "unrelated_to_item")) {
    collect.add(
      rule(
        "COM-03",
        "block",
        "E-101",
        "사업계획서 상의 창업아이템과 연관성이 낮은 항목입니다.",
        "사업계획서 상의 제품 제작과 연관성이 있어야 함",
        "사업계획서 상 어느 과업에 쓰이는지 근거를 첨부하거나, 해당 항목을 정산에서 제외하세요.",
      ),
    );
  }

  if (hasFlag(input, "kickback_suspected")) {
    collect.add(
      rule(
        "COM-04",
        "block",
        "E-101",
        "사업비를 지급 목적과 다른 용도로 사용한 정황(페이백)이 있습니다.",
        "공공재정환수법 — 사업비 전액 환수, 참여제한 5년, 제재부가금 최대 5배",
        "즉시 집행을 중단하고 주관기관에 자진 신고하세요. 제출하면 부정집행으로 처리됩니다.",
      ),
    );
  }

  const spec = CATEGORIES[input.category];
  const attached = new Set(input.evidence ?? []);
  for (const name of spec.requiredEvidence) {
    if (!attached.has(name)) collect.missingEvidence(name);
  }

  // 비목과 무관하게 금지되는 항목. 비목 변경으로는 해소되지 않으므로 오분류 안내보다 먼저 세웁니다.
  if (hasFlag(input, "office_furniture")) {
    collect.add(
      rule(
        "COM-06",
        "block",
        "E-101",
        "사무 공간용 집기·가구·기구 구입비는 어떤 비목으로도 집행할 수 없습니다.",
        "사무 공간에 들어가는 집기, 가구, 기구 등 구입비로는 집행 불가",
        "해당 품목을 정산 대상에서 제외하거나, 창업아이템과 직접 관련된 품목으로 교체하세요.",
      ),
    );
  }

  const misplaced = (input.itemFlags ?? []).find((flag) => {
    const target = FLAG_CORRECT_CATEGORY[flag];
    return target && target !== input.category;
  });
  if (misplaced) {
    const target = FLAG_CORRECT_CATEGORY[misplaced]!;
    collect.add(
      rule(
        "COM-05",
        "block",
        "E-101",
        `'${ITEM_FLAG_LABELS[misplaced]}' 항목은 ${CATEGORIES[target].name}로 분류해야 합니다.`,
        CATEGORIES[target].definition,
        `비목을 ${spec.name} → ${CATEGORIES[target].name}로 변경해 다시 제출하세요.`,
      ),
    );
  }
}

function checkMaterial(input: ExpenseInput, collect: FindingCollector) {
  const end = toTime(input.agreementEnd);
  const delivery = toTime(input.deliveryDate);
  if (end !== null && delivery !== null && delivery > end) {
    collect.add(rule("MAT-01", "block", "E-107", "협약기간 내에 납품되지 않는 재료비입니다.", "협약기간 내에 납품이 가능한 재료비에 한해 집행 가능", "협약종료일 이전 납품이 가능한 조건으로 재발주하세요."));
  }
  if (hasFlag(input, "office_supply")) {
    collect.add(rule("MAT-02", "block", "E-101", "멀티탭·키보드 등 사무용품은 재료비로 집행할 수 없습니다.", "재료비 위반사례 — 사무용품 구입", "시제품 제작에 직접 투입되는 재료만 남기고 사무용품은 제외하세요."));
  }
  if (hasFlag(input, "precious_material") && input.hasPriorApproval !== true) {
    collect.add(rule("MAT-03", "block", "E-106", "금속·보석·원석 등은 주관기관 사전승인 없이 구매할 수 없습니다.", "필요연관성이 높고 주관기관의 사전승인이 있을 경우 예외적으로 구매가능", "사전승인 요청서를 제출해 승인 회신을 받은 뒤 집행하세요."));
  }
  if (hasFlag(input, "imported_with_customs")) {
    collect.add(rule("MAT-04", "block", "E-105", "국외 구매 관세는 사업비로 집행할 수 없습니다.", "국외 기업과의 구매 거래 시 관세는 동 사업비로 집행 불가", "관세를 제외한 물품가액만 정산 금액으로 다시 계산하세요."));
  }
}

function checkOutsourcing(input: ExpenseInput, collect: FindingCollector) {
  const advance = input.advancePayment ?? 0;
  if (input.amount > POLICY.outsourcingPriorApprovalOver) {
    const needsApproval = input.hasPriorApproval !== true;
    if (needsApproval) {
      collect.add(
        rule(
          "OUT-01",
          "block",
          "E-106",
          `${won(POLICY.outsourcingPriorApprovalOver)} 초과 외주용역 계약은 주관기관 사전승인 후 집행해야 합니다.`,
          "2,000만원 초과 외주용역 계약 체결 시 주관기관의 사전승인을 득한 후 집행 가능하며 비교견적서 구비 필수",
          "비교견적서를 포함한 사전승인 요청서를 주관기관에 제출하고 승인 후 계약하세요.",
        ),
      );
    }
    if (!(input.evidence ?? []).includes("비교견적서")) collect.missingEvidence("비교견적서");
  }
  if (advance > 0 && advance > input.amount * POLICY.advanceRatioLimit) {
    collect.add(
      rule(
        "OUT-02",
        "block",
        "E-103",
        `선급금 ${won(advance)}이 계약금액의 50%(${won(input.amount * POLICY.advanceRatioLimit)})를 초과합니다.`,
        "선급금은 계약금액의 50%를 초과하여 집행 불가",
        `선급금을 ${won(input.amount * POLICY.advanceRatioLimit)} 이하로 낮추고 잔금 지급 조건으로 계약을 수정하세요.`,
      ),
    );
  }
  if (advance >= POLICY.advanceGuaranteeOver && !(input.evidence ?? []).includes("선급금보증보험증권")) {
    collect.add(
      rule(
        "OUT-03",
        "block",
        "E-102",
        `선급금이 ${won(POLICY.advanceGuaranteeOver)} 이상이므로 선급금보증보험증권이 필요합니다.`,
        "선급금이 500만원 이상일 경우 선금보증보험증권을 주관기관에 제출해야 하며 500만원 미만인 경우는 각서로 대체 가능",
        "보증보험증권을 발급받아 첨부하세요. 500만원 미만이면 각서로 대체할 수 있습니다.",
      ),
    );
  }
  collect.when(
    not(input.vendor?.industryRelated),
    "외주업체 업태·업종 연관성",
    rule("OUT-04", "block", "E-101", "외주용역 과업과 업체 사업자등록증 상 업태·업종의 연관성이 없습니다.", "외주용역의 과업과 사업자등록증 상의 업태·업종의 연관성 부재 시 집행 불가", "과업과 업종이 일치하는 업체로 재계약하거나 업체의 유사 제작경험 증빙을 첨부하세요."),
  );
  if (input.vendor?.type === "individual" || input.vendor?.type === "platform") {
    collect.add(
      rule(
        "OUT-05",
        "block",
        "E-108",
        "사업자등록이 없는 개인 또는 중계 플랫폼을 통한 외주는 집행할 수 없습니다.",
        "사업자 등록을 하지 않은 개인(프리랜서 등) 또는 중계 서비스(크몽, 위시켓 등)를 통한 사업비 집행 불가",
        "사업자등록증이 있는 업체와 직접 계약하세요.",
      ),
    );
  }
  if (hasFlag(input, "deliverable_not_working")) {
    collect.add(rule("OUT-06", "block", "E-101", "정산시점에 결과물이 정상 구동되지 않아 집행할 수 없습니다.", "외주용역 결과물이 정산시점에 정상적으로 구동되지 않는 경우 사업비 집행 불가", "구동 가능한 결과물과 검수 확인서를 확보한 뒤 정산하세요."));
  }
  if (hasFlag(input, "mass_production_mold")) {
    collect.add(rule("OUT-07", "block", "E-101", "양산 목적의 금형제작비는 집행할 수 없습니다.", "양산목적의 금형제작비는 집행 불가", "시제품 제작 범위로 과업을 재정의하세요."));
  }
  if (hasFlag(input, "penalty_or_damages")) {
    collect.add(rule("OUT-08", "block", "E-101", "위약금·손해배상금·지체상금은 사업비로 집행할 수 없습니다.", "창업기업의 귀책사유로 인한 용역계약 파기 시 발생하는 위약금·손해배상금·지체상금 등은 사업비로 집행 불가", "해당 금액을 정산 대상에서 제외하세요."));
  }
  // "이상"이므로 경계값 자체가 대상입니다. 사전심의 화면(PreDeliberation)과 같은 부등호를 씁니다.
  if (input.amount >= POLICY.outsourcingDeliberationOver) {
    collect.add(
      rule(
        "OUT-09",
        "info",
        "E-106",
        `${won(POLICY.outsourcingDeliberationOver)} 이상 외주 건은 사전심의 대상입니다.`,
        "주관기관 사업운영위원회를 통한 외주용역비 집행 적정성 사전 심의",
        "사전심의 합본(계약서·견적서·과업지시서 등)을 준비하세요.",
      ),
    );
  }
}

function checkEquipment(input: ExpenseInput, collect: FindingCollector) {
  const end = toTime(input.agreementEnd);
  const delivery = toTime(input.deliveryDate);
  if (end !== null && delivery !== null && daysBetween(delivery, end) < POLICY.equipmentDeliveryBeforeEndDays) {
    collect.add(
      rule(
        "EQP-01",
        "block",
        "E-107",
        "기자재는 협약종료일로부터 1개월 이전까지 납품되어야 합니다.",
        "협약종료일로부터 1개월 이전까지 납품되는 기자재 구입비(S/W 구입비 포함)로 집행",
        "납품일을 협약종료 1개월 이전으로 앞당기거나 다음 기수로 이월하세요.",
      ),
    );
  }
  if (hasFlag(input, "general_software") && input.hasPriorApproval !== true) {
    collect.add(
      rule(
        "EQP-02",
        "block",
        "E-106",
        "범용 사무용 소프트웨어는 주관기관의 장의 사전검토 없이 구매할 수 없습니다.",
        "사무용 소프트웨어(MS-Office, 한글, 백신 프로그램 등)는 원칙적으로 구매할 수 없으나 필요연관성이 높고 주관기관의 장의 사전검토를 얻은 경우 구매 가능",
        "제품 제작과의 필요연관성을 기재한 사전검토 요청서를 제출하세요.",
      ),
    );
  }
  if (hasFlag(input, "communication_device")) {
    collect.when(
      input.vendor?.industryRelated ?? null,
      "통신기기와 시제품 제작의 연관성",
      rule("EQP-04", "warn", "E-101", "통신기기는 시제품 제작과 연관성이 있는 경우에만 구매할 수 있습니다.", "통신기기(스마트폰, 태블릿 PC 등)는 사업계획서 상의 시제품제작과 연관성이 있는 경우에 한하여 구매 가능", "시제품 테스트 단말로 사용하는 근거를 사업계획서에서 인용해 첨부하세요."),
    );
  }
  if (hasFlag(input, "used_from_individual")) {
    collect.add(rule("EQP-05", "block", "E-108", "중고 기자재의 개인 간 거래는 집행할 수 없습니다.", "중고 기계·설비는 개인간 거래 불가, 중고상품 취급이 명시된 사업자와의 거래에 대해 집행 가능", "사업자등록증상 중고상품 소매업이 명시된 사업자와 거래하세요."));
  }
  // 개인 간 거래가 아니어도 중고 거래는 그냥 넘어가지 않습니다. 「중고상품 취급이 명시된
  // 사업자」라는 단서가 붙어 있어, 거래처 업종을 증빙으로 남겨야 정산에서 걸리지 않습니다.
  // EQP-05(개인 간 거래)가 이미 막은 건은 같은 말을 두 번 하지 않습니다.
  if (hasFlag(input, "used_item") && !hasFlag(input, "used_from_individual")) {
    collect.add(
      rule(
        "EQP-08",
        "warn",
        "E-102",
        "중고 기자재는 거래처가 중고상품 취급 사업자임을 증빙해야 합니다.",
        "중고 기계·설비는 개인간 거래 불가, 중고상품 취급이 명시된 사업자와의 거래에 한해 집행 가능",
        "거래처 사업자등록증(업태·종목에 중고상품 소매업 명시) 사본을 증빙에 포함하세요.",
      ),
    );
  }
  if (hasFlag(input, "camera_for_promotion_only")) {
    collect.add(rule("EQP-06", "block", "E-101", "단순 제품홍보용 카메라·캠코더는 구입할 수 없습니다.", "단순 제품홍보를 위한 촬영용 카메라, 캠코더 등 구입 불가", "아이템 개발용 영상콘텐츠 제작 목적임을 증빙하거나 항목을 제외하세요."));
  }
  collect.add(
    rule(
      "EQP-07",
      "info",
      "E-101",
      `구매 기자재는 지원사업 자산으로 협약종료 후 ${POLICY.equipmentRetentionYears}년간 관리해야 하며 임의처분이 불가합니다.`,
      "구매한 기자재는 협약기간 내에 지원사업 자산으로 구분하여 협약기간 종료 이후에도 5년간 관리",
      "자산 라벨을 부착하고 현물 사진을 보관함에 저장하세요.",
    ),
  );
}

function checkIp(input: ExpenseInput, collect: FindingCollector) {
  const start = toTime(input.agreementStart);
  const filed = toTime(input.ip?.filedAt);
  if (start !== null && filed !== null && filed < start) {
    collect.add(
      rule(
        "IP-01",
        "block",
        "E-107",
        "협약 이전에 출원한 지식재산권 관련 비용은 집행할 수 없습니다.",
        "협약 이전에 출원한 지식재산권 관련 비용(선행특허조사비, 우선심사청구, 등록비 등)은 집행 불가",
        "협약체결 이후 출원 건으로 교체하거나, 과제와 직접 관련된 갱신수수료·등록비용만 남기세요.",
      ),
    );
  }
  collect.when(
    not(input.ip?.applicantIsSelf),
    "출원인(최종권리권자) 명의",
    rule("IP-02", "block", "E-101", "출원인이 창업기업 본인이 아닙니다.", "출원인(최종권리권자)은 창업기업 본인이어야 함", "출원인을 창업기업(법인의 경우 법인명의)으로 정정하세요."),
  );
  if (hasFlag(input, "success_fee")) {
    collect.add(rule("IP-03", "block", "E-101", "특허 등록 성공보수는 집행할 수 없습니다.", "특허 등록에 발생하는 성공보수의 집행은 불가", "성공보수를 제외한 실 소요비용만 정산하세요."));
  }
}

function checkLabor(input: ExpenseInput, collect: FindingCollector) {
  const labor = input.labor ?? {};
  collect.when(labor.isRepresentative ?? null, "대표자 여부", rule("LAB-01", "block", "E-101", "창업기업 대표자는 사업비로 인건비를 집행할 수 없습니다.", "창업기업 대표자는 사업비로 인건비 집행 불가", "대표자 급여를 정산 대상에서 제외하세요."));
  collect.when(labor.isRelative ?? null, "친족관계 여부", rule("LAB-02", "block", "E-101", "창업자와 민법 제767조상 친족관계에 있는 자의 인건비는 지급할 수 없습니다.", "창업자와 민법 제767조상의 친족관계에 있는자의 인건비 지급불가", "해당 인력의 인건비를 정산 대상에서 제외하세요."));
  collect.when(
    not(labor.insuranceEnrolled),
    "4대보험 가입 여부",
    rule("LAB-03", "block", "E-102", "4대보험 미가입 인력의 인건비는 집행할 수 없습니다.", "인건비는 사업자 개시일 이후 4대사회보험 가입직원에 한하여 집행이 가능", "4대보험 가입 후 가입자명부를 첨부해 다시 제출하세요."),
  );
  const end = toTime(input.agreementEnd);
  const hired = toTime(labor.hiredAt);
  if (end !== null && hired !== null && daysBetween(hired, end) < POLICY.laborNewHireBeforeEndDays) {
    collect.add(
      rule(
        "LAB-04",
        "block",
        "E-107",
        "협약종료일 1개월 이내에 채용된 신규 인력의 인건비는 집행할 수 없습니다.",
        "신규 채용인력은 협약종료일 1개월 이전에 신규 채용한 인력에 한하여 인건비 집행 가능",
        "협약종료 1개월 이전 채용 인력으로 정산 대상을 조정하세요.",
      ),
    );
  }
  collect.when(labor.fundedByOtherProgram ?? null, "타 정부지원사업 자기부담 등재 여부", rule("LAB-05", "block", "E-101", "타 정부지원사업의 자기부담사업비로 등재된 직원은 인건비를 지급할 수 없습니다.", "인건비 지급대상 직원은 타 정부지원금의 자기부담사업비(현금 또는 현물)로 활용 불가", "중복 등재를 해제하거나 다른 인력으로 정산 대상을 변경하세요."));
  if (hasFlag(input, "retirement_reserve")) {
    collect.add(rule("LAB-06", "block", "E-101", "근로자의 퇴직급여충당금은 집행할 수 없습니다.", "근로자의 퇴직급여충당금 집행 불가", "충당금을 제외한 실지급 급여와 사업자부담 4대보험료만 계상하세요."));
  }
  if (hasFlag(input, "prepaid_before_work")) {
    collect.add(rule("LAB-07", "block", "E-105", "실제 근로 이전에 인건비를 사전 지급했습니다.", "인건비 위반사례 — 실제 근로하기 이전에 인건비 사전 지급", "근로 제공 이후 급여 지급일 기준으로 집행 내역을 정정하세요."));
  }
}

function checkFee(input: ExpenseInput, collect: FindingCollector) {
  const perDay = input.mentoring?.perPersonPerDay;
  const hourly = input.mentoring?.hourlyRate;
  if (typeof perDay === "number" && perDay > POLICY.mentoringPerDayLimit) {
    collect.add(rule("FEE-01", "block", "E-103", `멘토링비가 1인 1일 한도 ${won(POLICY.mentoringPerDayLimit)}을 초과했습니다.`, "멘토링비는 멘토 1인당 1일 30만원 초과 불가", `1일 지급액을 ${won(POLICY.mentoringPerDayLimit)} 이하로 조정하세요.`));
  }
  if (typeof hourly === "number" && hourly > POLICY.mentoringHourlyLimit) {
    collect.add(rule("FEE-02", "block", "E-103", `멘토링 시간당 단가가 한도 ${won(POLICY.mentoringHourlyLimit)}을 초과했습니다.`, "1시간당 최대 10만원", `시간당 단가를 ${won(POLICY.mentoringHourlyLimit)} 이하로 조정하세요.`));
  }
  if (typeof perDay === "number" && perDay > POLICY.mentoringWithholdingOver) {
    collect.add(rule("FEE-03", "info", "E-105", `${won(POLICY.mentoringWithholdingOver)}을 초과하는 멘토비는 기타소득세 8.8% 공제 후 집행합니다.`, "125,000원 초과하는 멘토비 집행 시 기타소득세(8.8%) 공제 후 집행(상위법 기준)", "원천징수 후 지급액과 이체증을 함께 첨부하세요."));
  }
  if (hasFlag(input, "vehicle_rental")) {
    collect.add(rule("FEE-04", "block", "E-101", "차량 임차 경비는 집행할 수 없습니다.", "차량(승용차, 화물차, 이륜자동차 등) 등의 임차 경비는 집행 불가", "해당 항목을 정산 대상에서 제외하세요."));
  }
  if (hasFlag(input, "office_deposit_or_maintenance")) {
    collect.add(rule("FEE-05", "block", "E-101", "임대 보증금·관리비는 집행할 수 없습니다.", "임대 보증금, 관리비는 집행 불가", "월 임차료만 분리해 정산 금액을 다시 계산하세요."));
  }
  if (hasFlag(input, "residential_space")) {
    collect.add(rule("FEE-06", "block", "E-101", "거주 형태 공간의 임대료는 집행할 수 없습니다.", "창업 아이템 개발·생산을 위한 사무공간의 임대가 아닌, 거주 형태 공간의 임대료 집행 불가", "사업 목적 사무공간으로 계약을 변경하세요."));
  }
  if (hasFlag(input, "sublease_contract")) {
    collect.add(rule("FEE-07", "block", "E-108", "'전대업'이 명시되지 않은 전대차 계약은 집행할 수 없습니다.", "공유 사무공간의 경우 '전대업'이 명시되어 있고 사업자등록증상 또는 법인등기부등본에 해당 주소가 확인되는 경우에 한하여 월 단위 계약 시 집행 가능", "임대인의 사업자등록증(전대업 명시)과 주소 확인 서류를 첨부하세요."));
  }
  if (hasFlag(input, "event_outside_agreement")) {
    collect.add(rule("FEE-08", "block", "E-107", "협약기간 외에 개최되는 학회·세미나·전시회 참가비는 집행할 수 없습니다.", "협약기간 내에 개최하는 학회, 세미나, 전시회 참가비에 한하여 집행 가능", "협약기간 내 개최 행사로 변경하세요."));
  }
  if (hasFlag(input, "invention_compensation")) {
    collect.add(rule("FEE-09", "block", "E-101", "발명보상금 등 보상금 성격의 비용은 집행할 수 없습니다.", "창업자 본인이 발명권자로 등재되어 있는 특허의 권리이전에 소요되는 비용 중 발명보상금 등 보상금 성격의 비용은 사업비로 집행 불가", "보상금을 제외한 권리이전 실비만 정산하세요."));
  }
  collect.add(rule("FEE-10", "info", "E-105", `협약종료 시점 회계법인 감사비 ${won(POLICY.auditFeeMandatory)}을 의무 계상해야 합니다.`, "전담기관장 또는 주관기관장이 지정한 회계법인 감사에 따른 비용(600,000원)을 의무 계상", "지급수수료 비목에 감사비를 미리 남겨두세요."));
}

function checkTravel(input: ExpenseInput, collect: FindingCollector) {
  const travel = input.travel ?? {};
  if (travel.isOverseas === true) {
    if (input.hasPriorApproval !== true) {
      collect.add(rule("TRV-01", "block", "E-106", "국외 출장은 출국일 이전에 주관기관 사전승인을 받아야 합니다.", "국외 출장 사유 발생 시 출국일 이전에 주관기관의 사전승인을 통하여 해외 여비 집행의 적정성을 필히 검토", "출국 전 사전승인 요청서를 제출하고 승인 회신을 첨부하세요."));
    }
    if (travel.seatClass && travel.seatClass !== "economy") {
      collect.add(rule("TRV-02", "block", "E-103", "해외 여비 항공 운임은 Economy Class로 한정됩니다.", "해외 여비인 경우 항공 운임은 Economy Class급으로 한정", "Economy Class 요금까지만 정산하고 차액은 자부담 처리하세요."));
    }
  } else if (travel.isOverseas === undefined || travel.isOverseas === null) {
    collect.unchecked("국외 출장 여부");
  }
  collect.when(
    not(travel.isPublicTransport),
    "대중교통 이용 여부",
    rule("TRV-03", "block", "E-102", "실 지출 증빙이 가능한 대중교통 이용비용만 집행할 수 있습니다.", "실 지출금액의 증빙이 가능한 대중교통(기차, 버스, 항공 등) 이용비용에 한하여 집행 가능", "대중교통 이용 영수증으로 증빙을 교체하세요."),
  );
  collect.when(
    not(input.labor?.insuranceEnrolled),
    "출장자 4대보험 가입 여부",
    rule("TRV-04", "block", "E-102", "4대보험이 완료된 대표·재직 임직원의 여비만 집행할 수 있습니다.", "대표, 재직 임직원이(4대 보험 완료) 사업화를 위해 출장 등의 사유로 소요되는 여비", "4대보험 가입자명부를 첨부하세요."),
  );
}

function checkTraining(input: ExpenseInput, collect: FindingCollector) {
  collect.when(
    not(input.labor?.insuranceEnrolled),
    "교육 대상자 4대보험 가입 여부",
    rule("TRN-01", "block", "E-102", "4대보험에 가입된 임직원의 교육훈련비만 집행할 수 있습니다.", "창업기업에 소속되어 4대보험에 가입되어 있는 임직원에 한함", "4대 보험가입자명부를 제출하세요."),
  );
  if (hasFlag(input, "self_paid_portion")) {
    collect.add(rule("TRN-02", "block", "E-101", "고용노동부 등이 주관하는 교육의 본인부담금은 집행할 수 없습니다.", "고용노동부 등이 주관하는 교육의 '본인부담금'은 사업비로 집행 불가", "본인부담금을 제외한 금액만 정산하세요."));
  }
  if (hasFlag(input, "refunded_course")) {
    collect.add(rule("TRN-03", "block", "E-105", "환급과정은 환급금액을 제외한 금액만 지급할 수 있습니다.", "고용노동부 등의 교육비 환급과정 교육 참가 시 환급금액을 제외한 금액에 한하여 지급가능", "환급 예정 금액을 차감한 실부담액으로 신청 금액을 정정하세요."));
  }
}

function checkAdvertising(input: ExpenseInput, collect: FindingCollector) {
  const advance = input.advancePayment ?? 0;
  if (advance > 0 && advance > input.amount * POLICY.advanceRatioLimit) {
    collect.add(rule("ADV-01", "block", "E-103", `선급금 ${won(advance)}이 계약금액의 50%를 초과합니다.`, "마케팅을 위해 계약, 외주용역을 진행하는 경우 외주용역비 기준·유의사항 준용", `선급금을 ${won(input.amount * POLICY.advanceRatioLimit)} 이하로 조정하세요.`));
  }
  if (advance >= POLICY.advanceGuaranteeOver && !(input.evidence ?? []).includes("선급금보증보험증권")) {
    collect.add(rule("ADV-02", "block", "E-102", `선급금이 ${won(POLICY.advanceGuaranteeOver)} 이상이므로 선급금보증보험증권이 필요합니다.`, "선급금이 500만원 이상일 경우, 선금보증보험증권을 주관기관에 제출", "보증보험증권 또는 이행보증각서를 첨부하세요."));
  }
  if (hasFlag(input, "giveaway_or_uniform")) {
    collect.add(rule("ADV-03", "block", "E-101", "일회성 배포용 기념품·유니폼·기프티콘은 집행할 수 없습니다.", "일회성 무작위 홍보를 위한 배포용 기념품 제작(부채, 샘플 화장품 등), 유니폼 제작, 기프티콘 등에 소요되는 비용 집행 불가", "해당 항목을 정산 대상에서 제외하세요."));
  }
  if (hasFlag(input, "prepaid_emoney")) {
    collect.add(rule("ADV-04", "block", "E-101", "협약 기간 이후 이월 가능한 전자화폐(비즈머니 등)는 구매할 수 없습니다.", "협약 기간 이후 잔여 금액의 발생 또는 이월하여 사용할 수 있는 전자화폐(비즈머니 등) 구매 불가", "협약기간 내 소진되는 광고 집행 건으로 대체하세요."));
  }
  const end = toTime(input.agreementEnd);
  const delivery = toTime(input.deliveryDate);
  if (end !== null && delivery !== null && delivery > end) {
    collect.add(rule("ADV-05", "block", "E-107", "광고·선전 활동은 협약기간 내에 완료되어야 합니다.", "모든 광고·선전 활동은 협약기간 내에 완료되어야 하며, 웹 호스팅·도메인 등록비 등은 협약기간 이내의 금액에 한하여 집행 가능", "협약기간 이내 분량만 안분해 정산 금액을 다시 계산하세요."));
  }
}

const CHECKS: Record<string, (input: ExpenseInput, collect: FindingCollector) => void> = {
  material: checkMaterial,
  outsourcing: checkOutsourcing,
  equipment: checkEquipment,
  ip: checkIp,
  labor: checkLabor,
  fee: checkFee,
  travel: checkTravel,
  training: checkTraining,
  advertising: checkAdvertising,
};

function summarize(verdict: ExpenseVerdict["verdict"], blocks: number, warns: number, missing: number) {
  if (verdict === "fail") return `제출 전 수정이 필요한 위반 ${blocks}건이 있습니다. 이 상태로 제출하면 반려됩니다.`;
  if (verdict === "review") {
    const parts = [warns ? `확인 권고 ${warns}건` : "", missing ? `증빙 누락 ${missing}건` : ""].filter(Boolean);
    return `${parts.join(", ")}이 있습니다. 보완 후 제출하면 반려 가능성이 낮아집니다.`;
  }
  return "규정 위반이 발견되지 않았습니다. 검토 요청을 진행할 수 있습니다.";
}

/**
 * 비목별 배정 잔액 대비 초과 여부.
 *
 * 반려 사유 중 "한도 초과"는 규정 위반이 아니라 예산 소진이라 룰만으로는 잡히지 않습니다.
 * 배정액이 등록된 팀에만 적용하고, 없으면 조용히 건너뜁니다(정보 부재를 위반으로 만들지 않습니다).
 */
function checkBudget(input: ExpenseInput, collect: FindingCollector) {
  const budget = input.budget;
  if (!budget || !Number.isFinite(budget.allocated) || budget.allocated <= 0) return;
  const remaining = budget.allocated - (budget.executed ?? 0);
  if (input.amount <= remaining) return;
  collect.add(
    rule(
      "BUD-01",
      "block",
      "E-103",
      `${CATEGORIES[input.category].name} 배정 잔액을 ${won(input.amount - remaining)} 초과합니다.`,
      "사업비는 비목별 배정액 범위에서 집행하며, 초과분은 자기부담",
      `집행 금액을 ${won(Math.max(0, remaining))} 이하로 줄이거나, 주관기관과 비목 변경(감액·증액)을 협의하세요.`,
    ),
  );
}

/** 비목 규정 기반 결정론적 판정. AI 없이도 동일한 결과를 냅니다. */
export function validateExpense(input: ExpenseInput): ExpenseVerdict {
  const collect = new FindingCollector();
  checkCommon(input, collect);
  CHECKS[input.category]?.(input, collect);
  checkBudget(input, collect);

  const { findings, missing, unknowns } = collect.result();
  const blocks = findings.filter((finding) => finding.severity === "block").length;
  const warns = findings.filter((finding) => finding.severity === "warn").length;
  const verdict: ExpenseVerdict["verdict"] = blocks > 0 ? "fail" : warns > 0 || missing.length > 0 || unknowns.length > 0 ? "review" : "pass";
  const severityOrder = { block: 0, warn: 1, info: 2 };

  return {
    verdict,
    category: input.category,
    categoryName: CATEGORIES[input.category].name,
    findings: [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]),
    missingEvidence: missing,
    unchecked: unknowns,
    preApprovalRequired: findings.some((finding) => finding.reasonCode === "E-106"),
    summary: summarize(verdict, blocks, warns, missing.length),
  };
}

/** 여러 건(사업비 집행 계획)을 한 번에 판정 — 매니저 일괄 검토용. */
export function validateExpensePlan(items: ExpenseInput[]) {
  const results = items.map((item) => ({ input: item, verdict: validateExpense(item) }));
  return {
    results,
    total: results.length,
    failed: results.filter((item) => item.verdict.verdict === "fail").length,
    review: results.filter((item) => item.verdict.verdict === "review").length,
    passed: results.filter((item) => item.verdict.verdict === "pass").length,
  };
}
