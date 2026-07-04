<template>
  <main class="size-full bg-white text-gray-900 flex flex-col">
    <header class="shrink-0 px-3 py-3 sm:px-4 sm:py-4 flex items-center justify-between gap-3 border-b">
      <div class="flex min-w-0 items-center gap-2">
        <button class="shrink-0 p-2 rounded-full active:bg-gray-100" @click="router.back()">
          <ArrowLeft :size="24" />
        </button>
        <h1 class="truncate text-lg font-semibold">{{ isEditing ? '판매글 수정' : '판매 등록' }}</h1>
      </div>
      <button
        :disabled="currentSellStep === 'publish' && (!valid || publishSaving)"
        :class="[
          'shrink-0 rounded-lg px-3 py-2 text-sm sm:px-4',
          currentSellStep !== 'publish' || (valid && !publishSaving) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400',
        ]"
        @click="currentSellStep === 'publish' ? publishListingAction() : goNextSellStep()"
      >
        {{ currentSellStep === 'publish' ? (publishSaving ? (isEditing ? '수정 중' : '게시 중') : (isEditing ? '수정' : '게시')) : '다음' }}
      </button>
    </header>

    <nav class="shrink-0 border-b bg-white px-3 py-3 sm:px-4" aria-label="판매 등록 단계">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="(step, index) in sellSteps"
          :key="step.id"
          type="button"
          :class="['min-w-0 rounded-lg border px-2 py-2 text-center text-xs', currentSellStep === step.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500']"
          @click="goToSellStep(step.id)"
        >
          <span class="block font-semibold">{{ index + 1 }}</span>
          <span class="mt-0.5 block truncate">{{ step.label }}</span>
        </button>
      </div>
    </nav>

    <section class="flex-1 overflow-y-auto px-3 py-4 pb-8 sm:p-4 sm:pb-8 space-y-5 sm:space-y-6">
      <section v-show="currentSellStep === 'media'" class="space-y-3">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-medium">사진 등록</h2>
          <span class="text-xs text-gray-500">대표 이미지는 검사하지 않습니다</span>
        </div>

        <PhotoSlot title="대표 이미지" help="판매글 목록에 보일 이미지" :image="coverImage" @picked="file => setImage('cover', file)" @clear="clearImage('cover')" />

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PhotoSlot title="표면 이미지" help="원형 가이드에 맞춰 촬영" :image="recordImage" @picked="file => setImage('record', file)" @clear="clearImage('record')" @open-camera="openSurfaceCamera('image')" />
          <VideoSlot title="표면 동영상" help="비스듬한 반사 가이드 촬영" :video="recordVideo" @picked="setRecordVideo" @clear="clearRecordVideo" @open-camera="openSurfaceCamera('video')" />
        </div>

        <section class="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div class="flex items-start gap-2">
            <Video :size="18" class="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-medium text-blue-950">촬영 가이드</p>
              <ul class="mt-2 space-y-1 text-xs text-gray-700">
                <li v-for="guide in recordVideoGuides" :key="guide" class="flex gap-2">
                  <span class="text-blue-600">•</span>
                  <span>{{ guide }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div v-if="recordMediaPreview" class="rounded-lg border p-3 text-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium">표면 상태 점수</p>
              <p class="text-gray-500 mt-1">{{ recordRecognition.signals[0] }}</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-blue-100 text-blue-700">
              {{ recordRecognition.surfaceScore }}점
            </span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">스크래치</p><p>{{ recordRecognition.scratchCount }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">위험도</p><p>{{ riskLabel(recordRecognition.scratchRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 영향</p><p>{{ recordRecognition.playbackImpact }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">반사</p><p>{{ riskLabel(recordRecognition.reflectionRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">강한 후보</p><p>{{ recordRecognition.scratchDetails?.highSeverity || 0 }}곳</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">표시 후보</p><p>{{ recordRecognition.scratchDetails?.displayedRegions ?? recordRecognition.scratchRegions.length }}곳</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">먼지/입자</p><p>{{ formatPercent(recordRecognition.scratchDetails?.dustRatio) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">홈 대비</p><p>{{ formatPercent(recordRecognition.scratchDetails?.grooveContrast) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">선명도</p><p>{{ formatMetric(recordRecognition.scratchDetails?.blurVariance) }}</p></div>
          </div>
          <ScratchInspectionPreview
            v-if="recordRecognition.scratchRegions.length"
            class="mt-3"
            :media-url="recordMediaPreview"
            :media-type="recordInspectionMediaType"
            :regions="recordRecognition.scratchRegions"
          />
          <div v-if="recordRecognition.scratchRegions.length" class="mt-3 rounded-lg bg-gray-950 text-white p-2 text-xs">
            스크래치 위치 후보 {{ recordRecognition.scratchRegions.length }}개가 감지되었습니다. 조명 반사와 먼지 가능성이 있어 판매 전 육안 확인을 함께 권장합니다.
          </div>
          <p v-if="recordRecognition.scratchRegions.length" class="mt-2 text-xs text-gray-500">
            빨간색·주황색·노란색 선은 분석 후보이며, 반사나 먼지 가능성은 육안으로 함께 확인해 주세요.
          </p>
        </div>
      </section>

      <section v-show="currentSellStep === 'details'" class="space-y-4">
        <h2 class="text-base font-medium">판매 정보</h2>
        <div>
          <label class="block text-sm mb-2">카탈로그 번호 *</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="form.catalogNumber" type="text" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="예: CL 1355, PCS 7088, ST-A-691671" @keydown.enter.prevent="searchCatalog" />
            <button type="button" class="w-full px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 disabled:text-gray-300 sm:w-auto" :disabled="isCatalogSearching || (form.catalogNumber.trim().length < 3 && form.title.trim().length < 2 && form.artist.trim().length < 2)" @click="searchCatalog">
              {{ isCatalogSearching ? '검색 중' : 'Discogs 검색' }}
            </button>
          </div>
          <p v-if="catalogLookupMessage" class="text-xs text-blue-600 mt-1">{{ catalogLookupMessage }}</p>
          <p v-if="catalogApiStatus" class="text-[11px] text-gray-500 mt-1">{{ catalogApiStatus }}</p>
        </div>

        <section v-if="catalogCandidates.length > 0" class="rounded-lg border p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">Discogs 후보</p>
            <span class="text-xs text-gray-500">{{ candidateSource === 'mock' ? '검색 실패' : candidateSource }}</span>
          </div>
          <div class="space-y-2">
            <button v-for="candidate in catalogCandidates" :key="candidate.id" type="button" :class="['w-full text-left rounded-lg border p-3', selectedCandidateId === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white']" @click="selectCatalogCandidate(candidate.id)">
              <p :class="['text-base font-semibold', selectedCandidateId === candidate.id ? 'text-blue-700' : 'text-gray-900']">{{ candidate.catalogNumber || '카탈로그 번호 미상' }}</p>
              <p class="mt-1 text-sm">{{ candidate.title }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ candidate.artist }} · {{ candidate.label }} · {{ candidate.country }} {{ candidate.year || '' }}</p>
            </button>
          </div>
          <button type="button" class="w-full py-3 rounded-lg bg-blue-600 text-white disabled:bg-gray-300" :disabled="!selectedCandidate" @click="applyCatalogCandidate">
            선택한 정보 적용
          </button>
        </section>

        <div>
          <label class="block text-sm mb-2">앨범명 *</label>
          <input v-model="form.title" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="Discogs 후보를 적용하거나 직접 입력하세요" />
        </div>
        <div>
          <label class="block text-sm mb-2">아티스트</label>
          <input v-model="form.artist" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="아티스트명" />
        </div>
      </section>

      <section v-show="currentSellStep === 'audio'" class="space-y-3">
        <h2 class="text-base font-medium">음질 녹음 분석</h2>
        <div class="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium text-indigo-950">스크래치 기준 녹음 추천</p>
              <p class="mt-1 text-xs text-gray-600">표면 이미지/동영상에서 감지한 스크래치 위치를 기준으로 녹음할 구간을 추천합니다.</p>
            </div>
            <button type="button" class="w-full shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white disabled:bg-gray-300 sm:w-auto" :disabled="!recordMediaPreview" @click="applyScratchAudioRecommendation">
              추천 적용
            </button>
          </div>
          <p class="mt-2 text-xs text-indigo-700">{{ scratchAudioRecommendation.summary }}</p>
          <div class="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-green-700">좋은 구간</p>
              <p class="mt-1">{{ scratchAudioRecommendation.good.title }}</p>
              <p class="mt-1 text-gray-500">{{ scratchAudioRecommendation.good.suggestedStart }} / {{ scratchAudioRecommendation.good.recordSeconds }}초</p>
              <p class="mt-2 text-gray-600">{{ scratchAudioRecommendation.good.guide }}</p>
            </div>
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-yellow-800">안 좋은 구간</p>
              <p class="mt-1">{{ scratchAudioRecommendation.noisy.title }}</p>
              <p class="mt-1 text-gray-500">{{ scratchAudioRecommendation.noisy.suggestedStart }} / {{ scratchAudioRecommendation.noisy.recordSeconds }}초</p>
              <p class="mt-2 text-gray-600">{{ scratchAudioRecommendation.noisy.guide }}</p>
            </div>
          </div>
          <div v-if="scratchAudioRecommendation.scratchNotes.length" class="mt-3 rounded-lg bg-white p-3 text-xs text-gray-700">
            <p class="font-medium text-gray-900">감지 근거</p>
            <ul class="mt-2 space-y-1">
              <li v-for="note in scratchAudioRecommendation.scratchNotes" :key="note" class="flex gap-2">
                <span class="text-indigo-600">•</span>
                <span>{{ note }}</span>
              </li>
            </ul>
          </div>
        </div>

        <AudioRecorder kind="ambient" :name="ambientAudioName" :url="ambientAudioUrl" :is-recording="recordingKind === 'ambient'" :seconds="recordingSeconds" description="주변음 5초 측정" @start="startAudioRecording('ambient')" @stop="stopAudioRecording" @clear="clearAudio('ambient')" />
        <div v-if="ambientAudioName" class="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          주변음 기준 샘플이 저장되었습니다. 이 값으로 마이크/방 소음을 빼고 LP 자체 잡음을 더 보수적으로 계산합니다.
        </div>
        <AudioRecorder kind="good" :name="goodAudioName" :url="goodAudioUrl" :is-recording="recordingKind === 'good'" :seconds="recordingSeconds" description="좋은 구간 녹음" @start="startAudioRecording('good')" @stop="stopAudioRecording" @clear="clearAudio('good')" />
        <p v-if="goodAudioRecordedAt" class="rounded-lg bg-green-50 p-3 text-xs text-green-800">좋은 구간 샘플 녹음일 {{ formatRecordedDate(goodAudioRecordedAt) }}</p>
        <AudioRecorder kind="noisy" :name="noisyAudioName" :url="noisyAudioUrl" :is-recording="recordingKind === 'noisy'" :seconds="recordingSeconds" description="안 좋은 구간 녹음" @start="startAudioRecording('noisy')" @stop="stopAudioRecording" @clear="clearAudio('noisy')" />
        <p v-if="noisyAudioRecordedAt" class="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-900">확인 구간 샘플 녹음일 {{ formatRecordedDate(noisyAudioRecordedAt) }}</p>

        <div v-if="goodAudioName" class="rounded-lg bg-green-50 p-3 text-xs text-green-800">
          좋은 구간은 {{ scratchAudioRecommendation.good.recordSeconds }}초 권장 길이로 저장됩니다. 분석은 실제 녹음 파일 전체를 기준으로 실행됩니다.
        </div>
        <div v-if="noisyAudioName" class="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-900">
          안 좋은 구간은 {{ scratchAudioRecommendation.noisy.recordSeconds }}초 권장 길이로 저장됩니다. 스크래치 후보가 있는 위치를 재생하며 녹음해 주세요.
        </div>

        <div v-if="recordingMessage" class="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
          <p>{{ recordingMessage }}</p>
          <button
            v-if="showMicSettingsButton"
            type="button"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            @click="openMicrophoneSettings"
          >
            마이크 권한 설정 열기
          </button>
        </div>
        <button type="button" class="w-full py-3 rounded-lg bg-gray-900 text-white disabled:bg-gray-300" :disabled="(!goodAudioFile && !noisyAudioFile) || audioAnalyzing" @click="runAudioAnalysis">
          {{ audioAnalyzing ? '음질 분석 중' : '녹음 파일로 음질 분석' }}
        </button>

        <div v-if="audioAnalysis" class="rounded-lg border p-3 space-y-3 text-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium">음질 분석 결과</p>
              <p class="text-gray-500 mt-1">{{ audioAnalysis.summary }}</p>
              <p v-if="isReferenceAudioAnalysis" class="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">주변음이 없거나 신뢰도가 낮아 참고용 분석으로 표시합니다. 점수는 유지하지만 판매 설명에는 확정 표현을 피합니다.</p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-1 sm:block sm:space-y-1 sm:text-right">
              <span class="inline-block px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                {{ audioAnalysis.audioGrade }} · {{ audioAnalysis.audioScore }}점
              </span>
              <span :class="['block px-2 py-1 rounded text-xs', isReferenceAudioAnalysis ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700']">{{ audioAnalysisBadge }}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클릭/팝</p><p>{{ audioAnalysis.clickCount ?? '-' }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">노이즈</p><p>{{ formatDb(audioAnalysis.noiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 위험</p><p>{{ riskLabel(audioAnalysis.playbackRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">주변음</p><p>{{ formatDb(audioAnalysis.ambientNoiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">보정 노이즈</p><p>{{ formatDb(audioAnalysis.adjustedNoiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">신뢰도</p><p>{{ audioAnalysis.analysisConfidence ?? '-' }}점</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">다이내믹</p><p>{{ formatDb(audioAnalysis.dynamicRangeDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클리핑</p><p>{{ riskLabel(audioAnalysis.clippingRisk || 'low') }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">좌우 편차</p><p>{{ formatDb(audioAnalysis.channelImbalanceDb) }}</p></div>
          </div>
          <div class="grid grid-cols-1 gap-2 text-xs">
            <div v-if="audioAnalysis.goodSample" class="rounded-lg bg-green-50 p-3">
              <p class="font-medium text-green-800">좋은 구간 {{ audioAnalysis.goodSample.score ?? '-' }}점</p>
              <p class="mt-1 text-gray-600">클릭 {{ audioAnalysis.goodSample.clickCount ?? 0 }}개 · 노이즈 {{ formatDb(audioAnalysis.goodSample.adjustedNoiseFloorDb ?? audioAnalysis.goodSample.noiseFloorDb) }} · 다이내믹 {{ formatDb(audioAnalysis.goodSample.dynamicRangeDb) }}</p>
            </div>
            <div v-if="audioAnalysis.noisySample" class="rounded-lg bg-yellow-50 p-3">
              <p class="font-medium text-yellow-900">주의 구간 {{ audioAnalysis.noisySample.score ?? '-' }}점</p>
              <p class="mt-1 text-gray-600">클릭 {{ audioAnalysis.noisySample.clickCount ?? 0 }}개 · 분당 {{ audioAnalysis.noisySample.clicksPerMinute ?? 0 }}개 · 노이즈 {{ formatDb(audioAnalysis.noisySample.adjustedNoiseFloorDb ?? audioAnalysis.noisySample.noiseFloorDb) }}</p>
            </div>
          </div>
          <p v-for="warning in audioAnalysis.warnings || []" :key="warning" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{{ warning }}</p>
        </div>
      </section>

      <section v-show="currentSellStep === 'publish'" class="space-y-4">
        <h2 class="text-base font-medium">게시 정보</h2>
        <div>
          <label class="block text-sm mb-2">판매 가격 *</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="form.price" type="number" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="가격 입력" />
            <button type="button" class="w-full px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 sm:w-auto" @click="recommendPrice">추천 가격</button>
          </div>
          <p v-if="priceMessage" class="mt-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{{ priceMessage }}</p>
          <div class="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm space-y-3">
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium text-blue-950">시세 기반 가격 제한</p>
              <button type="button" class="rounded-lg bg-white px-3 py-2 text-xs text-blue-600 disabled:text-gray-300" :disabled="marketLoading" @click="refreshMarketEstimate(false)">
                {{ marketLoading ? '확인 중' : '시세 확인' }}
              </button>
            </div>
            <div v-if="marketEstimate" class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div class="rounded bg-white p-2"><p class="text-gray-500">기준가</p><p>{{ formatWon(marketEstimate.basePrice) }}</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">하한가</p><p>{{ formatWon(marketEstimate.minPrice) }}</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">상한가</p><p>{{ formatWon(marketEstimate.maxPrice) }}</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">추천 판매가</p><p>{{ formatWon(marketEstimate.recommendedPrice) }}</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">즉시 판매가</p><p>{{ formatWon(marketEstimate.instantSalePrice) }}</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">구매 대기</p><p>{{ marketEstimate.metrics.buyOrderCount }}건</p></div>
              <div class="rounded bg-white p-2"><p class="text-gray-500">위시 대기</p><p>{{ marketEstimate.metrics.wishlistCount || 0 }}명</p></div>
            </div>
            <div v-if="marketEstimate" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p :class="['text-xs', marketPriceTone]">{{ marketPriceStatus }}</p>
              <button type="button" class="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white" @click="applyMarketRecommendedPrice">
                추천가 적용
              </button>
            </div>
            <p v-if="marketError" class="rounded-lg bg-red-50 p-2 text-xs text-red-700">{{ marketError }}</p>
          </div>
        </div>
        <div>
          <label class="block text-sm mb-2">거래 주소</label>
          <input v-model="form.location" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="예: 강남역, 홍대입구, 서울시청" @change="saveDraft(false)" />
          <p class="mt-1 text-xs text-gray-500">주소를 입력하거나 지도에서 핀 위치를 직접 선택하세요.</p>
          <div
            class="relative mt-3 h-56 touch-none overflow-hidden rounded-lg border bg-gray-100"
            @pointerdown="startFallbackMapDrag"
            @pointermove="moveFallbackMapDrag"
            @pointerup="endFallbackMapDrag"
            @pointercancel="endFallbackMapDrag"
            @pointerleave="endFallbackMapDrag"
          >
            <div ref="locationMapContainer" class="absolute inset-0"></div>
            <div v-if="locationMapFallbackHtml" class="absolute inset-0" v-html="locationMapFallbackHtml"></div>
            <div v-if="locationMapMessage" class="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-sm">
              <MapPin :size="14" class="shrink-0 text-blue-600" />
              <span>{{ locationMapMessage }}</span>
            </div>
            <button
              v-if="locationMapPoint"
              type="button"
              class="absolute right-2 top-2 z-10 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow-sm active:bg-blue-700"
              @click.stop="chooseMapLocation"
            >
              이 위치 선택
            </button>
            <div v-if="locationMapFallbackHtml" class="absolute left-2 top-2 z-10 flex overflow-hidden rounded-lg bg-white shadow-sm">
              <button type="button" class="px-3 py-2 text-base font-semibold active:bg-gray-100" @click.stop="zoomFallbackMap(1)">+</button>
              <button type="button" class="border-l px-3 py-2 text-base font-semibold active:bg-gray-100" @click.stop="zoomFallbackMap(-1)">-</button>
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm">상세 설명</label>
            <button type="button" class="text-xs text-blue-600" @click="fillDescription">감정 결과 반영</button>
          </div>
          <textarea v-model="form.description" class="w-full px-4 py-3 border rounded-lg min-h-36" placeholder="표면 상태와 음질 분석 결과를 적어 주세요." />
        </div>
        <div>
          <label class="block text-sm mb-2">태그</label>
          <input v-model="form.tags" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="#재즈 #초반 #감정서참고" />
        </div>
      </section>

      <section v-show="currentSellStep === 'publish'" class="rounded-lg border p-3 space-y-3">
        <h2 class="text-base font-medium">감정 요약</h2>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">표면</p><p>{{ recordRecognition.surfaceScore || '-' }}점</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">음질</p><p>{{ audioAnalysis?.audioScore || '-' }}점</p></div>
        </div>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.analysisConfirmed" type="checkbox" true-value="true" false-value="" class="mt-1" :disabled="!canCheckAnalysis" />
          <span>감정 결과는 판매 신뢰를 높이기 위한 참고 자료이며, 실제 재생과 육안 확인을 함께 안내하겠습니다.</span>
        </label>
        <p v-if="!canCheckAnalysis" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          표면 스크래치 분석과 정밀 음질 분석을 모두 완료해야 감정 확인을 체크할 수 있습니다.
        </p>
        <button type="button" class="w-full py-3 rounded-lg border" :disabled="draftSaving" @click="saveDraft(true)">
          {{ draftSaving ? '저장 중' : '임시 저장' }}
        </button>
        <button type="button" class="w-full py-3 rounded-lg border border-blue-200 text-blue-600" @click="startNewDraft">
          새 임시저장으로 작성
        </button>
        <div v-if="draftEntries.length" class="space-y-2">
          <p class="text-xs text-gray-500">저장된 임시글 {{ draftEntries.length }}개</p>
          <div v-for="entry in draftEntries" :key="entry.id" class="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <button type="button" class="min-w-0 flex-1 text-left" @click="loadDraftEntry(entry)">
              <p class="truncate text-sm">{{ entry.title }}</p>
              <p class="text-xs text-gray-500">{{ new Date(entry.updatedAt).toLocaleString('ko-KR') }}</p>
            </button>
            <button type="button" class="px-3 py-2 text-xs text-red-600" @click="removeDraftEntry(entry.id)">삭제</button>
          </div>
        </div>
        <p v-if="draftMessage" :class="['text-xs text-center', draftSavedToDb ? 'text-green-600' : 'text-amber-600']">{{ draftMessage }}</p>
      </section>
    </section>

    <footer class="shrink-0 border-t bg-white p-3 sm:p-4">
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 py-3 text-sm text-gray-700 disabled:text-gray-300"
          :disabled="currentSellStepIndex === 0"
          @click="goPreviousSellStep"
        >
          이전
        </button>
        <button
          v-if="currentSellStep !== 'publish'"
          type="button"
          class="rounded-lg bg-blue-600 py-3 text-sm text-white"
          @click="goNextSellStep"
        >
          다음
        </button>
        <button
          v-else
          type="button"
          :disabled="!valid || publishSaving"
          :class="['rounded-lg py-3 text-sm', valid && !publishSaving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400']"
          @click="publishListingAction"
        >
          {{ publishSaving ? (isEditing ? '수정 중' : '게시 중') : (isEditing ? '수정' : '게시') }}
        </button>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, MapPin, Mic, Upload, Video } from 'lucide-vue-next';
import {
  analyzeLpMedia,
  recognizeLpImage,
  type LpRecognition,
  type ScratchRegion,
} from '@/features/seller/services/analysis';
import { createPressingInfo, fetchDiscogsCandidates, type AlbumCandidate } from '@/features/seller/services/discogs';
import { analyzeAudioSamples, type AudioAnalysisResult } from '@/features/seller/services/audio';
import { fetchMarketPriceEstimate, fetchPriceRecommendation } from '@/features/seller/services/pricing';
import type { MarketPriceEstimate } from '@/shared/models/market';
import { useAppStore, type ListingDraftEntry } from '@/shared/stores/appStore';
import { openAppPermissionSettings } from '@/shared/services/appSettings';
import { canUseNativeAudioRecorder, startNativeAudioRecording, stopNativeAudioRecording } from '@/features/seller/services/nativeAudioRecorder';
import { setPendingSellDraft, takePendingCapture, takePendingSellDraft } from '@/features/seller/services/captureTransfer';
import {
  findKakaoMapPoint,
  getKakaoMapJavaScriptKey,
  loadKakaoMaps,
  type KakaoMapInstance,
  type KakaoMapPoint,
  type KakaoMarkerInstance,
} from '@/shared/services/kakaoMap';
import { fetchApi } from '@/shared/services/api';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const editingListingId = computed(() => String(route.params.id || ''));
const isEditing = computed(() => Boolean(editingListingId.value));
const sourceCollectionId = computed(() => String(route.query.collectionId || ''));
const isCollectionConversion = computed(() => Boolean(sourceCollectionId.value));
type SellStep = 'media' | 'details' | 'audio' | 'publish';
const sellSteps: Array<{ id: SellStep; label: string }> = [
  { id: 'media', label: '사진' },
  { id: 'details', label: '정보' },
  { id: 'audio', label: '음질' },
  { id: 'publish', label: '게시' },
];
const currentSellStep = ref<SellStep>('media');
const currentSellStepIndex = computed(() => sellSteps.findIndex(step => step.id === currentSellStep.value));
const goToSellStep = (step: SellStep) => { currentSellStep.value = step; };
const goNextSellStep = () => {
  const next = sellSteps[Math.min(sellSteps.length - 1, currentSellStepIndex.value + 1)];
  if (next) currentSellStep.value = next.id;
};
const goPreviousSellStep = () => {
  const previous = sellSteps[Math.max(0, currentSellStepIndex.value - 1)];
  if (previous) currentSellStep.value = previous.id;
};
const pendingSellDraft = isEditing.value ? null : takePendingSellDraft();
const restoredPendingSellDraft = Boolean(pendingSellDraft);
const draft = isEditing.value ? null : (pendingSellDraft || store.readDraft());
const draftForm = draft?.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
const draftImages = Array.isArray(draft?.images) ? draft.images as string[] : [];
const draftCoverImage = String(draft?.coverImageDataUrl || draftImages[0] || '');
const draftRecordImage = String(draft?.recordImageDataUrl || draftImages[1] || '');

const form = reactive({
  title: String(draftForm.title || ''),
  artist: String(draftForm.artist || ''),
  catalogNumber: String(draftForm.catalogNumber || ''),
  price: String(draftForm.price || ''),
  location: String(draftForm.location || store.settings.trade.defaultLocation || ''),
  description: String(draftForm.description || ''),
  tags: String(draftForm.tags || ''),
  pressing: String(draftForm.pressing || ''),
  analysisConfirmed: String(draftForm.analysisConfirmed || ''),
});

const coverImage = ref(draftCoverImage);
const recordImage = ref(draftRecordImage);
const extraImages = ref<string[]>(draftImages.slice(2, 5));
const recordVideo = ref(String(draft?.recordVideoDataUrl || ''));
const ambientAudioFile = ref<File | null>(null);
const goodAudioFile = ref<File | null>(null);
const noisyAudioFile = ref<File | null>(null);
const ambientAudioName = ref(String(draft?.ambientAudioFileName || ''));
const goodAudioName = ref(String(draft?.goodAudioFileName || ''));
const noisyAudioName = ref(String(draft?.noisyAudioFileName || ''));
const ambientAudioDataUrl = ref(String(draft?.ambientAudioDataUrl || ''));
const goodAudioDataUrl = ref(String(draft?.goodAudioDataUrl || ''));
const noisyAudioDataUrl = ref(String(draft?.noisyAudioDataUrl || ''));
const goodAudioRecordedAt = ref(String(draft?.goodAudioRecordedAt || ''));
const noisyAudioRecordedAt = ref(String(draft?.noisyAudioRecordedAt || ''));
const ambientAudioUrl = ref(ambientAudioDataUrl.value);
const goodAudioUrl = ref(goodAudioDataUrl.value);
const noisyAudioUrl = ref(noisyAudioDataUrl.value);
const goodSampleStart = ref(Number(draft?.goodSampleStart ?? 0));
const goodSampleEnd = ref(Number(draft?.goodSampleEnd ?? 20));
const noisySampleStart = ref(Number(draft?.noisySampleStart ?? 0));
const noisySampleEnd = ref(Number(draft?.noisySampleEnd ?? 15));
const recordingKind = ref<'ambient' | 'good' | 'noisy' | null>(null);
const recordingSeconds = ref(0);
const recordingMessage = ref('');
const showMicSettingsButton = ref(false);
const audioAnalyzing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingTimer: number | null = null;
let recordingChunks: BlobPart[] = [];
let recordingUsesNative = false;

const audioAnalysis = ref<AudioAnalysisResult | null>((draft?.audioAnalysis as AudioAnalysisResult | null) || null);
const recordRecognition = ref<LpRecognition>(recognizeLpImage(recordImage.value || recordVideo.value));
const priceMessage = ref('');
const marketEstimate = ref<MarketPriceEstimate | null>(null);
const marketLoading = ref(false);
const marketError = ref('');
const catalogLookupMessage = ref('');
const catalogApiStatus = ref('');
const draftMessage = ref('');
const draftSaving = ref(false);
const publishSaving = ref(false);
const draftSavedToDb = ref(false);
const draftEntries = ref<ListingDraftEntry[]>(store.readDrafts());
const catalogCandidates = ref<AlbumCandidate[]>([]);
const selectedCandidateId = ref('');
const candidateSource = ref<'discogs' | 'discogs-direct' | 'mock' | ''>('');
const isCatalogSearching = ref(false);
let catalogLookupRequest = 0;
const locationMapContainer = ref<HTMLElement | null>(null);
const locationMapMessage = ref('');
const locationMapPoint = ref<KakaoMapPoint | null>(null);
const locationMapFallbackHtml = ref('');
const locationMapZoom = ref(15);
let locationMap: KakaoMapInstance | null = null;
let locationMarker: KakaoMarkerInstance | null = null;
let locationMapRequest = 0;
let locationMapTimer: number | undefined;
let fallbackDrag:
  | { pointerId: number; startX: number; startY: number; startLat: number; startLng: number; moved: boolean }
  | null = null;
const fallbackPointers = new Map<number, { x: number; y: number }>();
let fallbackPinch:
  | { startDistance: number; startZoom: number; lastZoom: number }
  | null = null;

const recordMediaPreview = computed(() => recordImage.value || recordVideo.value);
const recordInspectionMediaType = computed<'image' | 'video'>(() => recordImage.value ? 'image' : 'video');
const selectedCandidate = computed(() => catalogCandidates.value.find(candidate => candidate.id === selectedCandidateId.value));
const riskLabel = (risk?: 'low' | 'medium' | 'high' | string) => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';
const formatPercent = (value?: number | null) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-';
const formatMetric = (value?: number | null, digits = 1) => typeof value === 'number' ? value.toFixed(digits) : '-';
const formatWon = (value?: number | null) => typeof value === 'number' && value > 0 ? `${value.toLocaleString()}원` : '-';
const formatRecordedDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('ko-KR');
const isReferenceAudioAnalysis = computed(() => Boolean(audioAnalysis.value && (
  audioAnalysis.value.source === 'fallback'
  || audioAnalysis.value.source === 'mock'
  || Number(audioAnalysis.value.analysisConfidence || 0) < 60
)));
const audioAnalysisBadge = computed(() => isReferenceAudioAnalysis.value ? '참고용 분석' : '정밀 분석');
const recordVideoGuides = [
  '밝은 곳에서 LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '카메라를 살짝 움직여 반사 위치가 이동하게 찍으면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 표면을 넓게 담고, 강한 플래시는 피해주세요.',
];
const clockLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 0.5;
  const centerY = (region.y1 + region.y2) / 2 - 0.5;
  const angle = Math.atan2(centerY, centerX);
  const hour = Math.round(((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 12) || 12;
  return `${hour}시 방향`;
};
const grooveLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 0.5;
  const centerY = (region.y1 + region.y2) / 2 - 0.5;
  const radius = Math.sqrt(centerX * centerX + centerY * centerY);
  if (radius < 0.18) return '안쪽 홈';
  if (radius < 0.34) return '중간 홈';
  return '바깥쪽 홈';
};
const scratchAudioRecommendation = computed(() => {
  const severeRegions = [...recordRecognition.value.scratchRegions]
    .filter(region => region.severity !== 'low')
    .sort((left, right) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      return severityScore[right.severity || 'low'] - severityScore[left.severity || 'low'];
    });
  const targetRegion = severeRegions[0] || recordRecognition.value.scratchRegions[0];
  const hasScratch = Boolean(targetRegion);
  const badLocation = targetRegion ? `${clockLabelForScratch(targetRegion)} ${grooveLabelForScratch(targetRegion)}` : '도입부 또는 조용한 홈';
  const goodTitle = recordRecognition.value.scratchRisk === 'high'
    ? '스크래치 후보와 떨어진 안정 구간'
    : '표면 점수가 안정적인 중간 구간';
  const noisyTitle = hasScratch ? `스크래치 후보 주변: ${badLocation}` : '표면 확인용 조용한 구간';
  const scratchNotes = [
    recordMediaPreview.value
      ? `표면 점수 ${recordRecognition.value.surfaceScore || 0}점, 스크래치 후보 ${recordRecognition.value.scratchCount || 0}개입니다.`
      : '표면 이미지나 동영상을 먼저 올리면 스크래치 기준 추천이 더 정확해집니다.',
    hasScratch
      ? `${badLocation}에서 ${targetRegion?.severity === 'high' ? '강한' : targetRegion?.severity === 'medium' ? '중간' : '약한'} 스크래치 후보가 보입니다.`
      : '뚜렷한 스크래치 후보가 적어 일반 검수용으로 조용한 구간 녹음을 권장합니다.',
    `재생 영향 평가는 ${recordRecognition.value.playbackImpact || '낮음'}입니다.`,
  ];
  return {
    summary: hasScratch
      ? '안 좋은 구간은 스크래치 후보가 보이는 홈 주변을, 좋은 구간은 그 반대쪽의 안정적인 홈을 녹음해 비교하세요.'
      : '스크래치 후보가 적으므로 좋은 구간 위주로 녹음하고, 조용한 도입부를 짧게 추가 확인하세요.',
    scratchNotes,
    good: {
      title: goodTitle,
      suggestedStart: hasScratch ? '스크래치 반대쪽 홈에서 시작' : '중간 트랙 20초',
      recordSeconds: 20,
      guide: '클릭/팝이 적게 들리는 구간을 골라 기준 음질 샘플로 사용합니다.',
    },
    noisy: {
      title: noisyTitle,
      suggestedStart: hasScratch ? `${badLocation} 재생 구간` : '도입부 0~15초',
      recordSeconds: recordRecognition.value.scratchRisk === 'high' ? 20 : 15,
      guide: hasScratch
        ? '바늘이 해당 위치를 지나는 부분을 녹음해 스크래치가 실제 재생에 영향을 주는지 확인합니다.'
        : '조용한 구간에서 바닥 잡음과 미세 클릭을 확인합니다.',
    },
  };
});
const hasSurfaceAnalysis = computed(() => Boolean(recordMediaPreview.value && recordRecognition.value.isRecord && recordRecognition.value.source !== 'fallback'));
const hasPreciseAudioAnalysis = computed(() => Boolean(audioAnalysis.value && !isReferenceAudioAnalysis.value));
const canConfirmAnalysis = computed(() => Boolean(form.catalogNumber.trim() && hasSurfaceAnalysis.value && hasPreciseAudioAnalysis.value));
const canUseCollectionAnalysis = computed(() => isCollectionConversion.value && Boolean(audioAnalysis.value || goodAudioRecordedAt.value || noisyAudioRecordedAt.value));
const canCheckAnalysis = computed(() => canConfirmAnalysis.value || canUseCollectionAnalysis.value);
const valid = computed(() => Boolean(form.title && form.price && (isEditing.value || (canCheckAnalysis.value && form.analysisConfirmed === 'true'))));

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const dataUrlToFile = (dataUrl: string, filename: string) => {
  const [header, base64Data = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], filename, { type: mimeType });
};

const resetConfirmation = () => {
  form.analysisConfirmed = '';
};

const setImage = async (slot: 'cover' | 'record', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (slot === 'cover') {
    coverImage.value = dataUrl;
  } else {
    recordImage.value = dataUrl;
    recordRecognition.value = await analyzeLpMedia(dataUrl, 'image');
    resetConfirmation();
  }
  saveDraft(false);
};

const setRecordVideo = async (file: File) => {
  recordVideo.value = await readFileAsDataUrl(file);
  recordRecognition.value = await analyzeLpMedia(recordVideo.value, 'video');
  resetConfirmation();
  saveDraft(false);
};

const clearImage = (slot: 'cover' | 'record') => {
  if (slot === 'cover') {
    coverImage.value = '';
  } else {
    recordImage.value = '';
    recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
    resetConfirmation();
  }
  saveDraft(false);
};

const clearRecordVideo = () => {
  recordVideo.value = '';
  recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
  resetConfirmation();
  saveDraft(false);
};

const loadListingForEdit = () => {
  const listing = store.listings.find(album => album.id === editingListingId.value);
  if (!listing) return false;
  form.title = listing.title;
  form.artist = listing.artist;
  form.catalogNumber = listing.catalogNumber;
  form.price = String(listing.price || '');
  form.location = listing.location || store.settings.trade.defaultLocation || '';
  form.description = listing.description;
  form.tags = [listing.genre, ...(listing.isRare ? ['희귀반'] : []), ...(listing.isFirstPress ? ['초반'] : [])].filter(Boolean).join(' ');
  form.pressing = listing.isFirstPress ? '초반 추정' : '';
  form.analysisConfirmed = 'true';
  coverImage.value = listing.coverImageDataUrl || listing.images[0] || '';
  recordImage.value = listing.recordImageDataUrl || listing.images[1] || '';
  recordVideo.value = listing.recordVideoDataUrl || '';
  extraImages.value = listing.images.slice(2, 5);
  recordRecognition.value = (listing.analysisReport?.recordSurface as LpRecognition | undefined)
    || recognizeLpImage(recordImage.value || recordVideo.value, recordVideo.value && !recordImage.value ? 'video' : 'image');
  if (listing.audioSamples?.good) {
    goodAudioName.value = listing.audioSamples.good.name;
    goodAudioDataUrl.value = listing.audioSamples.good.dataUrl || '';
    goodAudioRecordedAt.value = listing.audioSamples.good.recordedAt || '';
    goodAudioUrl.value = goodAudioDataUrl.value;
    goodSampleStart.value = Number(listing.audioSamples.good.startSeconds || 0);
    goodSampleEnd.value = Number(listing.audioSamples.good.endSeconds || listing.audioSamples.good.durationSeconds || 20);
  }
  if (listing.audioSamples?.noisy) {
    noisyAudioName.value = listing.audioSamples.noisy.name;
    noisyAudioDataUrl.value = listing.audioSamples.noisy.dataUrl || '';
    noisyAudioRecordedAt.value = listing.audioSamples.noisy.recordedAt || '';
    noisyAudioUrl.value = noisyAudioDataUrl.value;
    noisySampleStart.value = Number(listing.audioSamples.noisy.startSeconds || 0);
    noisySampleEnd.value = Number(listing.audioSamples.noisy.endSeconds || listing.audioSamples.noisy.durationSeconds || 15);
  }
  audioAnalysis.value = (listing.analysisReport?.audio as AudioAnalysisResult | undefined) || {
    source: 'librosa',
    audioScore: listing.audioScore,
    audioGrade: listing.audioGrade,
    playbackRisk: listing.audioScore >= 82 ? 'low' : listing.audioScore >= 70 ? 'medium' : 'high',
    clickCount: 0,
    noiseFloorDb: null,
    ambientNoiseFloorDb: null,
    adjustedNoiseFloorDb: null,
    dynamicRangeDb: null,
    analysisConfidence: 70,
    warnings: [],
    summary: '기존 판매글의 음질 정보를 불러왔습니다.',
  };
  return true;
};

const handleAudio = async (kind: 'ambient' | 'good' | 'noisy', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (kind === 'ambient') {
    ambientAudioFile.value = file;
    ambientAudioName.value = file.name;
    ambientAudioDataUrl.value = dataUrl;
    ambientAudioUrl.value = dataUrl;
  } else if (kind === 'good') {
    goodAudioFile.value = file;
    goodAudioName.value = file.name;
    goodAudioDataUrl.value = dataUrl;
    goodAudioRecordedAt.value = new Date().toISOString();
    goodAudioUrl.value = dataUrl;
    goodSampleStart.value = 0;
    goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds || 20;
  } else {
    noisyAudioFile.value = file;
    noisyAudioName.value = file.name;
    noisyAudioDataUrl.value = dataUrl;
    noisyAudioRecordedAt.value = new Date().toISOString();
    noisyAudioUrl.value = dataUrl;
    noisySampleStart.value = 0;
    noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds || 15;
  }
  audioAnalysis.value = null;
  resetConfirmation();
  saveDraft(false);
};

const clearRecordingTimer = () => {
  if (recordingTimer !== null) {
    window.clearInterval(recordingTimer);
    recordingTimer = null;
  }
};

const cleanupRecordingStream = () => {
  recordingStream?.getTracks().forEach(track => track.stop());
  recordingStream = null;
};

const audioRecordingMessage = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') return '주변음을 5초 정도 측정 중입니다. LP를 재생하지 말고 방 소리만 들려주세요.';
  if (kind === 'good') return '좋은 구간을 녹음 중입니다. 20초 정도가 적당합니다.';
  return '안 좋은 구간을 녹음 중입니다. 15초 정도가 적당합니다.';
};

const audioSampleFilePrefix = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') return 'ambient-sample';
  if (kind === 'good') return 'good-section-sample';
  return 'bad-section-sample';
};

const mimeTypeForRecording = () => {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
};

const startAudioRecording = async (kind: 'ambient' | 'good' | 'noisy') => {
  if (recordingKind.value) return;
  showMicSettingsButton.value = false;
  if (canUseNativeAudioRecorder()) {
    try {
      await startNativeAudioRecording();
      recordingUsesNative = true;
      recordingKind.value = kind;
      recordingSeconds.value = 0;
      recordingMessage.value = audioRecordingMessage(kind);
      recordingTimer = window.setInterval(() => { recordingSeconds.value += 1; }, 1000);
      return;
    } catch (error) {
      recordingUsesNative = false;
      recordingMessage.value = error instanceof Error ? error.message : '마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';
      showMicSettingsButton.value = true;
      return;
    }
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    recordingMessage.value = '이 기기에서는 실시간 녹음을 사용할 수 없습니다.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints });
    recordingStream = stream;
    recordingChunks = [];
    const mimeType = mimeTypeForRecording();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recordingKind.value = kind;
    recordingSeconds.value = 0;
    recordingMessage.value = audioRecordingMessage(kind);
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const activeKind = recordingKind.value || kind;
      const blobType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(recordingChunks, { type: blobType });
      const extension = blobType.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `${audioSampleFilePrefix(activeKind)}-${Date.now()}.${extension}`, { type: blobType });
      void handleAudio(activeKind, file);
      recordingKind.value = null;
      recordingChunks = [];
      clearRecordingTimer();
      cleanupRecordingStream();
      mediaRecorder = null;
      recordingMessage.value = '녹음이 저장되었습니다. 바로 음질 분석을 실행할 수 있습니다.';
    };
    mediaRecorder.start();
    recordingTimer = window.setInterval(() => { recordingSeconds.value += 1; }, 1000);
  } catch {
    recordingKind.value = null;
    clearRecordingTimer();
    cleanupRecordingStream();
    mediaRecorder = null;
    recordingMessage.value = '마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';
    showMicSettingsButton.value = true;
  }
};

const openMicrophoneSettings = async () => {
  try {
    await openAppPermissionSettings();
  } catch (error) {
    recordingMessage.value = error instanceof Error ? error.message : 'Android 앱 설정을 열 수 없습니다.';
  }
};

const stopAudioRecording = () => {
  if (recordingUsesNative) {
    const activeKind = recordingKind.value;
    void stopNativeAudioRecording()
      .then(result => {
        if (!activeKind) return;
        const file = dataUrlToFile(result.dataUrl, `${audioSampleFilePrefix(activeKind)}-${Date.now()}.${result.extension || 'm4a'}`);
        void handleAudio(activeKind, file);
        recordingMessage.value = '녹음이 저장되었습니다. 바로 음질 분석을 실행할 수 있습니다.';
      })
      .catch(error => {
        recordingMessage.value = error instanceof Error ? error.message : '녹음을 저장하지 못했습니다.';
        showMicSettingsButton.value = true;
      })
      .finally(() => {
        recordingKind.value = null;
        recordingUsesNative = false;
        clearRecordingTimer();
      });
    return;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
};

const clearAudio = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') {
    ambientAudioFile.value = null;
    ambientAudioName.value = '';
    ambientAudioDataUrl.value = '';
    ambientAudioUrl.value = '';
  } else if (kind === 'good') {
    goodAudioFile.value = null;
    goodAudioName.value = '';
    goodAudioDataUrl.value = '';
    goodAudioRecordedAt.value = '';
    goodAudioUrl.value = '';
    goodSampleStart.value = 0;
    goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds || 20;
  } else {
    noisyAudioFile.value = null;
    noisyAudioName.value = '';
    noisyAudioDataUrl.value = '';
    noisyAudioRecordedAt.value = '';
    noisyAudioUrl.value = '';
    noisySampleStart.value = 0;
    noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds || 15;
  }
  audioAnalysis.value = null;
  resetConfirmation();
  saveDraft(false);
};

const runAudioAnalysis = async () => {
  audioAnalyzing.value = true;
  recordingMessage.value = '서버 정밀 분석으로 먼저 확인하고, 기기 내 분석으로 한 번 더 대조하는 중입니다.';
  try {
    audioAnalysis.value = await analyzeAudioSamples({ ambient: ambientAudioFile.value || undefined, good: goodAudioFile.value || undefined, noisy: noisyAudioFile.value || undefined });
    recordingMessage.value = audioAnalysis.value.source === 'browser'
      ? '기기 내 음질 분석이 완료되었습니다.'
      : audioAnalysis.value.source === 'fallback' || audioAnalysis.value.source === 'mock'
        ? '정밀 파형 해석이 어려워 임시 점수를 표시했습니다. 다시 녹음하거나 WAV/M4A/WebM 파일을 올려보세요.'
        : '서버 음질 분석이 완료되었습니다.';
    fillDescription();
    saveDraft(false);
  } catch (error) {
    recordingMessage.value = error instanceof Error ? error.message : '음질 분석에 실패했습니다. 다시 시도해 주세요.';
  } finally {
    audioAnalyzing.value = false;
  }
};

const applyScratchAudioRecommendation = () => {
  goodSampleStart.value = 0;
  goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds;
  noisySampleStart.value = 0;
  noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds;
  saveDraft(false);
};

const selectCatalogCandidate = (candidateId: string) => {
  selectedCandidateId.value = candidateId;
};

const searchCatalog = async () => {
  const catalog = form.catalogNumber.trim();
  const title = form.title.trim();
  const artist = form.artist.trim();
  if ((catalog.length < 3 && title.length < 2 && artist.length < 2) || isCatalogSearching.value) return;
  const requestId = ++catalogLookupRequest;
  isCatalogSearching.value = true;
  catalogLookupMessage.value = 'Discogs에서 후보를 찾는 중입니다.';
  catalogApiStatus.value = '';
  try {
    const result = await fetchDiscogsCandidates(catalog, title, artist);
    if (requestId !== catalogLookupRequest) return;
    catalogCandidates.value = result.candidates;
    candidateSource.value = result.source;
    const lookupError = 'error' in result && result.error ? result.error : '';
    catalogApiStatus.value = `요청: ${result.apiBaseUrl} / ${result.source} / 후보 ${result.candidates.length}개${lookupError ? ` / ${lookupError}` : ''}`;
    if (result.candidates.length) {
      selectedCandidateId.value = result.candidates[0].id;
      catalogLookupMessage.value = `${result.candidates.length}개 후보를 찾았습니다. 맞는 후보를 선택해 주세요.`;
    } else {
      selectedCandidateId.value = '';
      catalogLookupMessage.value = '일치하는 후보가 없습니다. 앨범명과 아티스트를 직접 입력해 주세요.';
    }
  } finally {
    if (requestId === catalogLookupRequest) isCatalogSearching.value = false;
  }
};

const applyCatalogCandidate = () => {
  if (!selectedCandidate.value) return;
  form.title = selectedCandidate.value.title;
  form.artist = selectedCandidate.value.artist;
  form.catalogNumber = selectedCandidate.value.catalogNumber;
  const pressing = createPressingInfo(selectedCandidate.value);
  form.pressing = pressing.pressing;
  catalogLookupMessage.value = `${selectedCandidate.value.title} 정보를 적용했습니다.`;
  resetConfirmation();
};

watch(() => form.catalogNumber, () => {
  catalogLookupMessage.value = '';
  catalogApiStatus.value = '';
  catalogCandidates.value = [];
  selectedCandidateId.value = '';
});

const lonLatToTile = (lat: number, lng: number, zoom: number) => {
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale);
  return { x, y };
};

const latLngToWorldPixel = (lat: number, lng: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin(lat * Math.PI / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
};

const worldPixelToLatLng = (x: number, y: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const lng = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
};

const clampMapZoom = (zoom: number) => Math.max(12, Math.min(18, zoom));

const getPointerDistance = () => {
  const points = Array.from(fallbackPointers.values());
  if (points.length < 2) return 0;
  const [first, second] = points;
  return Math.hypot(second.x - first.x, second.y - first.y);
};

const clampLatLng = (lat: number, lng: number) => ({
  lat: Math.max(-85, Math.min(85, lat)),
  lng: ((lng + 540) % 360) - 180,
});

const parsePickedLocation = (value: string): KakaoMapPoint | null => {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    title: '선택한 거래 위치',
    addressName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
};

const escapeMapText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderFallbackMap = (point: KakaoMapPoint) => {
  const zoom = locationMapZoom.value;
  const centerPixel = latLngToWorldPixel(point.lat, point.lng, zoom);
  const centerTileX = Math.floor(centerPixel.x / 256);
  const centerTileY = Math.floor(centerPixel.y / 256);
  const tiles: string[] = [];
  for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
    for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
      const x = centerTileX + xOffset;
      const y = centerTileY + yOffset;
      const left = x * 256 - centerPixel.x;
      const top = y * 256 - centerPixel.y;
      tiles.push(`<img src="https://tile.openstreetmap.org/${zoom}/${x}/${y}.png" style="position:absolute;left:calc(50% + ${left}px);top:calc(50% + ${top}px);width:256px;height:256px;" alt="">`);
    }
  }
  const title = escapeMapText(point.title);
  const address = escapeMapText(point.addressName);
  locationMapFallbackHtml.value = `
    <div style="position:absolute;inset:0;overflow:hidden;background:#e5e7eb;touch-action:none;">
      ${tiles.join('')}
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);width:24px;height:24px;border-radius:999px;background:#2563eb;border:4px solid white;box-shadow:0 6px 18px rgba(0,0,0,.25);"></div>
      <div style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:8px;background:rgba(255,255,255,.94);padding:8px 10px;font-size:12px;color:#1f2937;box-shadow:0 3px 10px rgba(0,0,0,.12);">
        ${title}<br><span style="color:#6b7280;">${address}</span>
      </div>
    </div>
  `;
};

const findLocationPointByRest = async (keyword: string): Promise<KakaoMapPoint | null> => {
  const query = new URLSearchParams({ keyword, count: '1' });
  const response = await fetchApi(`/address/search?${query.toString()}`, {}, 9000);
  if (!response.ok) return null;
  const payload = await response.json() as {
    candidates?: Array<{
      latitude?: string;
      longitude?: string;
      placeName?: string;
      roadAddress?: string;
      jibunAddress?: string;
      address?: string;
    }>;
  };
  const candidate = payload.candidates?.[0];
  const lat = Number(candidate?.latitude);
  const lng = Number(candidate?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    title: candidate?.placeName || keyword,
    addressName: candidate?.roadAddress || candidate?.jibunAddress || candidate?.address || keyword,
  };
};

const updateFallbackMapCenter = (lat: number, lng: number) => {
  const next = clampLatLng(lat, lng);
  const point = {
    lat: next.lat,
    lng: next.lng,
    title: '선택한 거래 위치',
    addressName: `${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`,
  };
  locationMapPoint.value = point;
  renderFallbackMap(point);
  locationMapMessage.value = '지도를 움직인 뒤 이 위치 선택을 누르세요.';
};

const startFallbackMapDrag = (event: PointerEvent) => {
  if (!locationMapFallbackHtml.value || !locationMapPoint.value) return;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture?.(event.pointerId);
  fallbackPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (fallbackPointers.size >= 2) {
    const distance = getPointerDistance();
    fallbackDrag = null;
    fallbackPinch = {
      startDistance: distance,
      startZoom: locationMapZoom.value,
      lastZoom: locationMapZoom.value,
    };
    return;
  }
  fallbackDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLat: locationMapPoint.value.lat,
    startLng: locationMapPoint.value.lng,
    moved: false,
  };
};

const moveFallbackMapDrag = (event: PointerEvent) => {
  if (fallbackPointers.has(event.pointerId)) {
    fallbackPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (fallbackPinch && fallbackPointers.size >= 2 && locationMapPoint.value) {
    const distance = getPointerDistance();
    if (fallbackPinch.startDistance > 0 && distance > 0) {
      const zoomDelta = Math.log2(distance / fallbackPinch.startDistance) * 2;
      const nextZoom = clampMapZoom(Math.round(fallbackPinch.startZoom + zoomDelta));
      if (nextZoom !== fallbackPinch.lastZoom) {
        locationMapZoom.value = nextZoom;
        fallbackPinch.lastZoom = nextZoom;
        renderFallbackMap(locationMapPoint.value);
        locationMapMessage.value = `확대 ${locationMapZoom.value}단계 · 지도를 움직인 뒤 이 위치 선택을 누르세요.`;
      }
    }
    return;
  }
  if (!fallbackDrag || fallbackDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - fallbackDrag.startX;
  const dy = event.clientY - fallbackDrag.startY;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  fallbackDrag.moved = true;
  const zoom = locationMapZoom.value;
  const startPixel = latLngToWorldPixel(fallbackDrag.startLat, fallbackDrag.startLng, zoom);
  const next = worldPixelToLatLng(startPixel.x - dx, startPixel.y - dy, zoom);
  updateFallbackMapCenter(next.lat, next.lng);
};

const endFallbackMapDrag = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  target.releasePointerCapture?.(event.pointerId);
  fallbackPointers.delete(event.pointerId);
  if (fallbackPointers.size < 2) fallbackPinch = null;
  if (fallbackDrag?.pointerId === event.pointerId) fallbackDrag = null;
};

const pickedLocationDescriptionLine = (point: KakaoMapPoint) => {
  const coords = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  const place = point.addressName && point.addressName !== coords ? `${point.addressName} (${coords})` : coords;
  return `거래 위치: ${place}`;
};

const applyPickedLocationToDescription = (point: KakaoMapPoint) => {
  const nextLine = pickedLocationDescriptionLine(point);
  const lines = form.description.split('\n');
  const index = lines.findIndex(line => line.trim().startsWith('거래 위치:') || line.trim().startsWith('거래 주소:'));
  if (index >= 0) {
    lines[index] = nextLine;
    form.description = lines.join('\n').trim();
    return;
  }
  form.description = [form.description.trim(), nextLine].filter(Boolean).join('\n');
};

const chooseMapLocation = async () => {
  const point = locationMapPoint.value;
  if (!point) return;
  form.location = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  applyPickedLocationToDescription(point);
  locationMapMessage.value = '선택한 핀 위치가 거래 장소로 저장되었습니다.';
  await saveDraft(false);
};

const zoomFallbackMap = (delta: number) => {
  const point = locationMapPoint.value;
  if (!point) return;
  locationMapZoom.value = clampMapZoom(locationMapZoom.value + delta);
  renderFallbackMap(point);
  locationMapMessage.value = `확대 ${locationMapZoom.value}단계 · 지도를 움직인 뒤 이 위치 선택을 누르세요.`;
};

const renderLocationMap = async () => {
  await nextTick();
  const container = locationMapContainer.value;
  const query = form.location.trim();
  const requestId = ++locationMapRequest;

  if (!container) return;
  if (!query) {
    locationMarker?.setMap(null);
    locationMapPoint.value = null;
    locationMapFallbackHtml.value = '';
    locationMapMessage.value = '거래 장소를 입력하면 지도가 표시됩니다.';
    return;
  }

  const pickedPoint = parsePickedLocation(query);
  if (pickedPoint) {
    locationMarker?.setMap(null);
    locationMapPoint.value = pickedPoint;
    renderFallbackMap(pickedPoint);
    locationMapMessage.value = '지도를 움직인 뒤 이 위치 선택을 누르세요.';
    return;
  }

  const restPoint = await findLocationPointByRest(query).catch(() => null);
  if (requestId !== locationMapRequest) return;
  if (restPoint) {
    locationMarker?.setMap(null);
    locationMapPoint.value = restPoint;
    renderFallbackMap(restPoint);
    locationMapMessage.value = '지도를 움직인 뒤 이 위치 선택을 누르세요.';
    return;
  }

  if (!getKakaoMapJavaScriptKey()) {
    locationMapMessage.value = '카카오 JavaScript 키가 없어 지도를 표시할 수 없습니다.';
    return;
  }

  locationMapMessage.value = '지도 위치를 찾는 중입니다.';
  try {
    locationMapFallbackHtml.value = '';
    const kakao = await loadKakaoMaps();
    const point = await findKakaoMapPoint(query, kakao);
    if (requestId !== locationMapRequest) return;

    if (!point) {
      locationMarker?.setMap(null);
      locationMapPoint.value = null;
      locationMapMessage.value = `"${query}" 위치를 찾지 못했습니다.`;
      return;
    }

    const center = new kakao.maps.LatLng(point.lat, point.lng);
    if (!locationMap) {
      locationMap = new kakao.maps.Map(container, { center, level: 3 });
    } else {
      locationMap.setCenter(center);
      locationMap.relayout();
    }

    locationMarker?.setMap(null);
    locationMarker = new kakao.maps.Marker({ position: center, map: locationMap });
    locationMapPoint.value = point;
    locationMapMessage.value = `${point.title} 지도 표시 중`;
    window.setTimeout(() => locationMap?.relayout(), 0);
  } catch (error) {
    if (requestId !== locationMapRequest) return;
    const point = await findLocationPointByRest(query).catch(() => null);
    if (requestId !== locationMapRequest) return;
    if (point) {
      locationMarker?.setMap(null);
      locationMapPoint.value = point;
      renderFallbackMap(point);
      locationMapMessage.value = `${point.title} 지도 표시 중`;
      return;
    }
    locationMapPoint.value = null;
    locationMapFallbackHtml.value = '';
    locationMapMessage.value = error instanceof Error ? error.message : '카카오맵을 표시하지 못했습니다.';
  }
};

const scheduleLocationMap = () => {
  if (locationMapTimer) window.clearTimeout(locationMapTimer);
  locationMapTimer = window.setTimeout(() => {
    void renderLocationMap();
  }, 450);
};

watch(() => form.location, () => {
  scheduleLocationMap();
});

const currentImages = () => [coverImage.value, recordImage.value, ...extraImages.value].filter(Boolean);

const currentDraft = () => ({
  images: currentImages(),
  coverImageDataUrl: coverImage.value,
  recordImageDataUrl: recordImage.value,
  recordVideoDataUrl: recordVideo.value,
  ambientAudioFileName: ambientAudioName.value,
  goodAudioFileName: goodAudioName.value,
  noisyAudioFileName: noisyAudioName.value,
  ambientAudioDataUrl: ambientAudioDataUrl.value,
  goodAudioDataUrl: goodAudioDataUrl.value,
  noisyAudioDataUrl: noisyAudioDataUrl.value,
  goodAudioRecordedAt: goodAudioRecordedAt.value,
  noisyAudioRecordedAt: noisyAudioRecordedAt.value,
  goodSampleStart: goodSampleStart.value,
  goodSampleEnd: goodSampleEnd.value,
  noisySampleStart: noisySampleStart.value,
  noisySampleEnd: noisySampleEnd.value,
  audioAnalysis: audioAnalysis.value,
  audioRecommendations: scratchAudioRecommendation.value,
  formData: { ...form },
});

const openSurfaceCamera = (mode: 'image' | 'video') => {
  setPendingSellDraft(currentDraft());
  router.push(mode === 'video' ? '/sell/camera?mode=video' : '/sell/camera');
};

const saveDraft = async (showAlert = true) => {
  if (draftSaving.value) return;
  draftSaving.value = true;
  const result = await store.saveDraftToServer(currentDraft());
  draftEntries.value = store.readDrafts();
  draftSavedToDb.value = result.persisted;
  draftMessage.value = result.message;
  draftSaving.value = false;
  if (showAlert) setTimeout(() => { draftMessage.value = ''; }, 2400);
};

const loadDraftEntry = (entry: ListingDraftEntry) => {
  store.activateDraft(entry);
  window.location.reload();
};

const removeDraftEntry = async (draftId: string) => {
  await store.deleteDraft(draftId);
  draftEntries.value = store.readDrafts();
};

const startNewDraft = () => {
  store.setActiveDraftId(`local-${Date.now()}`);
  localStorage.removeItem('vinyl-check-listing-draft');
  window.location.reload();
};

const recommendPrice = async () => {
  priceMessage.value = 'Discogs 거래 기록과 상품 품질 점수를 확인하는 중입니다.';
  try {
    const result = await fetchPriceRecommendation({
      catalogNumber: form.catalogNumber.trim(),
      title: form.title.trim(),
      artist: form.artist.trim(),
      releaseId: selectedCandidate.value?.releaseId,
      surfaceScore: recordRecognition.value.surfaceScore,
      audioScore: audioAnalysis.value?.audioScore,
      scratchRisk: recordRecognition.value.scratchRisk,
      playbackRisk: audioAnalysis.value?.playbackRisk,
    });
    form.price = String(result.recommended_price);
    void refreshMarketEstimate(false);
    const range = result.price_range ? `추천 범위 ${result.price_range.min.toLocaleString()}~${result.price_range.max.toLocaleString()}원. ` : '';
    const discogs = result.discogs?.suggestedPrice || result.discogs?.marketplaceLow
      ? `Discogs 기준 ${result.discogs.suggestedPrice ? `판매 이력 ${result.discogs.suggestedPrice.toLocaleString()}원` : '판매 이력 확인 불가'}${result.discogs.marketplaceLow ? `, 현재 최저 ${result.discogs.marketplaceLow.toLocaleString()}원` : ''}. `
      : '';
    const confidence = result.confidence ? `신뢰도 ${result.confidence}점. ` : '';
    priceMessage.value = `${result.recommended_price.toLocaleString()}원 추천. ${range}${discogs}${confidence}${result.reason}`;
  } catch {
    const catalog = form.catalogNumber.toLowerCase().trim();
    const title = form.title.toLowerCase().trim();
    const matched = store.listings.find(album => album.id !== editingListingId.value && ((catalog && album.catalogNumber.toLowerCase() === catalog) || (title && album.title.toLowerCase().includes(title))));
    const baseAlbums = store.listings.filter(album => album.id !== editingListingId.value && album.price > 0);
    const averagePrice = baseAlbums.length ? baseAlbums.reduce((sum, album) => sum + album.price, 0) / baseAlbums.length : 100000;
    const quality = audioAnalysis.value?.audioScore ? Math.max(0.7, Math.min(1.08, audioAnalysis.value.audioScore / 82)) : 1;
    const price = Math.round((matched ? ((matched.priceRange.min + matched.priceRange.max) / 2) : averagePrice) * quality / 1000) * 1000;
    form.price = String(price);
    void refreshMarketEstimate(false);
    priceMessage.value = `Discogs 가격 추천 연결 실패로 앱 내 시세와 품질 점수 기준 ${price.toLocaleString()}원을 임시 추천합니다.`;
  }
};

const fillDescription = () => {
  const audioPrefix = isReferenceAudioAnalysis.value ? '음질 참고용 분석' : '음질 분석';
  const sampleDates = [goodAudioRecordedAt.value, noisyAudioRecordedAt.value]
    .filter(Boolean)
    .map(formatRecordedDate);
  const parts = [
    form.title ? `${form.title}${form.artist ? ` - ${form.artist}` : ''}` : '',
    form.catalogNumber ? `카탈로그 번호: ${form.catalogNumber}` : '',
    form.location ? `거래 주소: ${form.location}` : '',
    recordMediaPreview.value ? `표면 상태 점수 ${recordRecognition.value.surfaceScore}점, 스크래치 후보 ${recordRecognition.value.scratchCount}개, 재생 영향 ${recordRecognition.value.playbackImpact}.` : '',
    recordMediaPreview.value ? `음질 녹음 추천: 좋은 구간은 ${scratchAudioRecommendation.value.good.title}, 안 좋은 구간은 ${scratchAudioRecommendation.value.noisy.title}.` : '',
    sampleDates.length ? `샘플 녹음일: ${[...new Set(sampleDates)].join(', ')}` : '',
    audioAnalysis.value ? `${audioPrefix}: ${audioAnalysis.value.audioGrade} (${audioAnalysis.value.audioScore}점), 클릭/팝 후보 ${audioAnalysis.value.clickCount ?? 0}개, 재생 위험 ${riskLabel(audioAnalysis.value.playbackRisk)}.` : '',
    '감정 결과는 판매 설명 참고용이며 실제 재생과 육안 확인을 함께 권장합니다.',
  ].filter(Boolean);
  form.description = parts.join('\n');
};

const normalizeSegment = (start: number, end: number, fallbackEnd: number) => {
  const safeStart = Math.max(0, Number.isFinite(start) ? start : 0);
  const safeEnd = Math.max(safeStart + 1, Number.isFinite(end) ? end : fallbackEnd);
  return { startSeconds: safeStart, endSeconds: safeEnd, durationSeconds: safeEnd - safeStart };
};

const audioSamplePayload = () => {
  const goodSegment = normalizeSegment(goodSampleStart.value, goodSampleEnd.value, scratchAudioRecommendation.value.good.recordSeconds || 20);
  const noisySegment = normalizeSegment(noisySampleStart.value, noisySampleEnd.value, scratchAudioRecommendation.value.noisy.recordSeconds || 15);
  return {
    ...(goodAudioName.value ? { good: { name: goodAudioName.value, dataUrl: goodAudioDataUrl.value, recordedAt: goodAudioRecordedAt.value || new Date().toISOString(), ...goodSegment } } : {}),
    ...(noisyAudioName.value ? { noisy: { name: noisyAudioName.value, dataUrl: noisyAudioDataUrl.value, recordedAt: noisyAudioRecordedAt.value || new Date().toISOString(), ...noisySegment } } : {}),
  };
};

const rarityKeywords = ['희귀', 'rare', '초반', 'first press', 'firstpress', '오리지널', 'original', '한정', 'limited', '프로모', 'promo', '테스트', 'test pressing', '번호판', 'numbered', 'obi'];
const hasRareHint = (values: string[]) => {
  const haystack = values.join(' ').toLowerCase().replace(/-/g, ' ');
  return rarityKeywords.some(keyword => haystack.includes(keyword));
};
const listingIsFirstPress = () => {
  const pressing = form.pressing.toLowerCase();
  return form.pressing.includes('초반') || pressing.includes('first');
};
const listingHasRareSignal = (tags: string[]) => listingIsFirstPress() || hasRareHint([...tags, form.pressing]);

const marketPriceTone = computed(() => {
  if (!marketEstimate.value) return 'text-gray-600';
  if (marketEstimate.value.priceStatus === 'above_range') return 'text-orange-600';
  if (marketEstimate.value.priceStatus === 'below_range') return 'text-green-600';
  return 'text-blue-700';
});
const marketPriceStatus = computed(() => {
  if (!marketEstimate.value) return '';
  if (marketEstimate.value.priceStatus === 'above_range') return '상한가보다 높습니다.';
  if (marketEstimate.value.priceStatus === 'below_range') return '하한가보다 낮습니다.';
  return '적정 범위 안입니다.';
});

const refreshMarketEstimate = async (applyRecommended = false) => {
  if (marketLoading.value) return;
  const tags = form.tags.replace(/,/g, ' ').split(/\s+/).map(tag => tag.trim()).filter(Boolean);
  marketLoading.value = true;
  marketError.value = '';
  try {
    const estimate = await fetchMarketPriceEstimate({
      listing_id: isEditing.value ? editingListingId.value : undefined,
      title: form.title.trim(),
      artist: form.artist.trim(),
      catalog_number: form.catalogNumber.trim(),
      price: Number(form.price) || undefined,
      year: selectedCandidate.value?.year,
      audio_grade: audioAnalysis.value?.audioGrade,
      pressing_condition: form.pressing.trim(),
      is_first_press: listingIsFirstPress(),
      is_rare: listingHasRareSignal(tags),
      location: form.location.trim(),
    });
    marketEstimate.value = estimate;
    if (applyRecommended && estimate.recommendedPrice > 0) form.price = String(estimate.recommendedPrice);
    priceMessage.value = `기준가 ${formatWon(estimate.basePrice)}, 추천가 ${formatWon(estimate.recommendedPrice)}. ${marketPriceStatus.value}`;
  } catch (error) {
    marketError.value = error instanceof Error ? error.message : '시세를 불러오지 못했습니다.';
  } finally {
    marketLoading.value = false;
  }
};

const applyMarketRecommendedPrice = () => {
  if (!marketEstimate.value?.recommendedPrice) return;
  form.price = String(marketEstimate.value.recommendedPrice);
  void refreshMarketEstimate(false);
};

const publishListingAction = async () => {
  if (!valid.value || publishSaving.value) return;
  publishSaving.value = true;
  if (!form.description.trim()) fillDescription();
  const tags = form.tags.replace(/,/g, ' ').split(/\s+/).map(tag => tag.trim()).filter(Boolean);
  const payload = {
    title: form.title.trim(),
    artist: form.artist.trim(),
    catalog_number: form.catalogNumber.trim(),
    discogs_release_id: selectedCandidate.value?.releaseId,
    discogs_cover_image_url: selectedCandidate.value?.coverImageUrl,
    release_label: selectedCandidate.value?.label,
    release_country: selectedCandidate.value?.country,
    year: selectedCandidate.value?.year,
    price: Number(form.price),
    description: form.description.trim(),
    tags,
    location: form.location.trim(),
    images: currentImages(),
    cover_image_data_url: coverImage.value,
    record_image_data_url: recordImage.value,
    record_video_data_url: recordVideo.value,
    audio_grade: audioAnalysis.value?.audioGrade,
    audio_score: audioAnalysis.value?.audioScore,
    audio_samples: audioSamplePayload(),
    is_rare: listingHasRareSignal(tags),
    is_first_press: listingIsFirstPress(),
    analysis_report: {
      pressing: form.pressing,
      coverImageDataUrl: coverImage.value,
      recordImageDataUrl: recordImage.value,
      recordVideoDataUrl: recordVideo.value,
      recordSurface: recordRecognition.value,
      audio: audioAnalysis.value,
      audioRecommendations: scratchAudioRecommendation.value,
      audioSamples: audioSamplePayload(),
    },
  };
  const result = isEditing.value
    ? await store.updateListing(editingListingId.value, payload)
    : await store.publishListing(payload);
  publishSaving.value = false;
  if (!result.ok) {
    if ('priceEstimate' in result && result.priceEstimate) marketEstimate.value = result.priceEstimate as MarketPriceEstimate;
    alert(result.message);
    return;
  }
  if (!isEditing.value && result.listing?.id && sourceCollectionId.value) {
    store.markCollectionConverted(sourceCollectionId.value, result.listing.id);
  }
  if (!isEditing.value) store.clearDraft();
  if (result.listing?.id) localStorage.setItem('vinyl-check-last-sell-report-listing-id', result.listing.id);
  router.push(isEditing.value && result.listing
    ? `/app/album/${result.listing.id}?mine=true`
    : { path: '/sell/report', query: result.listing?.id ? { id: result.listing.id } : {} });
};

onMounted(async () => {
  void renderLocationMap();
  if (isEditing.value) {
    const loaded = loadListingForEdit();
    if (!loaded) {
      await store.loadListingsFromServer();
      if (!loadListingForEdit()) {
        alert('수정할 판매글을 찾을 수 없습니다.');
        router.push('/app/profile');
        return;
      }
    }
  }
  if (form.price || form.title || form.catalogNumber) void refreshMarketEstimate(false);
  let appliedScannedMedia = false;
  const scannedRecordImage = await takePendingCapture('image') || localStorage.getItem('vinyl-check-scanned-record-image');
  if (scannedRecordImage) {
    localStorage.removeItem('vinyl-check-scanned-record-image');
    recordImage.value = scannedRecordImage;
    recordRecognition.value = await analyzeLpMedia(scannedRecordImage, 'image');
    appliedScannedMedia = true;
  }
  const scannedRecordVideo = await takePendingCapture('video') || localStorage.getItem('vinyl-check-scanned-record-video');
  if (scannedRecordVideo) {
    localStorage.removeItem('vinyl-check-scanned-record-video');
    recordVideo.value = scannedRecordVideo;
    recordRecognition.value = await analyzeLpMedia(scannedRecordVideo, 'video');
    appliedScannedMedia = true;
  }
  if (appliedScannedMedia) await saveDraft(false);
  if (ambientAudioDataUrl.value && !ambientAudioFile.value) {
    ambientAudioFile.value = dataUrlToFile(ambientAudioDataUrl.value, ambientAudioName.value || 'ambient-sample.webm');
  }
  if (goodAudioDataUrl.value && !goodAudioFile.value) {
    goodAudioFile.value = dataUrlToFile(goodAudioDataUrl.value, goodAudioName.value || 'good-sample.webm');
  }
  if (noisyAudioDataUrl.value && !noisyAudioFile.value) {
    noisyAudioFile.value = dataUrlToFile(noisyAudioDataUrl.value, noisyAudioName.value || 'bad-section-sample.webm');
  }
  const draftsResult = await store.loadDraftsFromServer();
  draftEntries.value = draftsResult.drafts;
  if (!appliedScannedMedia && !restoredPendingSellDraft) {
    const result = await store.loadDraftFromServer();
    if (result.persisted) {
      draftSavedToDb.value = true;
      draftMessage.value = '저장된 판매글 초안을 불러왔습니다.';
      setTimeout(() => { draftMessage.value = ''; }, 2200);
    }
  }
});

onBeforeUnmount(() => {
  if (locationMapTimer) window.clearTimeout(locationMapTimer);
  locationMarker?.setMap(null);
  if (recordingUsesNative) void stopNativeAudioRecording().catch(() => undefined);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearRecordingTimer();
  cleanupRecordingStream();
});

const ScratchInspectionPreview = defineComponent({
  props: {
    mediaUrl: { type: String, required: true },
    mediaType: { type: String as PropType<'image' | 'video'>, required: true },
    regions: { type: Array as PropType<ScratchRegion[]>, default: () => [] },
  },
  setup(props) {
    const strokeForSeverity = (severity?: ScratchRegion['severity']) => {
      if (severity === 'high') return '#ef4444';
      if (severity === 'medium') return '#f97316';
      return '#eab308';
    };
    const lineNodes = () => props.regions.flatMap((region, index) => {
      const color = strokeForSeverity(region.severity);
      const keyBase = `${region.x1}-${region.y1}-${region.x2}-${region.y2}-${index}`;
      return [
        h('line', {
          key: `${keyBase}-halo`,
          x1: region.x1,
          y1: region.y1,
          x2: region.x2,
          y2: region.y2,
          stroke: 'rgba(255,255,255,0.72)',
          'stroke-width': 10,
          'stroke-linecap': 'round',
          'vector-effect': 'non-scaling-stroke',
        }),
        h('line', {
          key: `${keyBase}-line`,
          x1: region.x1,
          y1: region.y1,
          x2: region.x2,
          y2: region.y2,
          stroke: color,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          'vector-effect': 'non-scaling-stroke',
        }),
      ];
    });

    return () => h('div', { class: 'rounded-lg border bg-gray-950 p-2 text-white' }, [
      h('div', { class: 'mb-2 flex items-center justify-between gap-2 text-xs' }, [
        h('span', { class: 'font-medium' }, '스크래치 후보 표시'),
        props.mediaType === 'video'
          ? h('span', { class: 'rounded bg-white/10 px-2 py-1 text-[11px] text-white/75' }, '대표 프레임 기준')
          : null,
      ]),
      h('div', { class: 'relative aspect-square overflow-hidden rounded bg-black' }, [
        props.mediaType === 'video'
          ? h('video', { src: props.mediaUrl, controls: true, class: 'h-full w-full object-contain' })
          : h('img', { src: props.mediaUrl, alt: '스크래치 후보 표시 표면 이미지', class: 'h-full w-full object-contain' }),
        h('svg', {
          class: 'pointer-events-none absolute inset-0 h-full w-full',
          viewBox: '0 0 1 1',
          preserveAspectRatio: 'none',
          'aria-hidden': 'true',
        }, lineNodes()),
      ]),
      h('div', { class: 'mt-2 flex flex-wrap gap-2 text-[11px] text-white/80' }, [
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-red-500' }),
          '강한 후보',
        ]),
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-orange-500' }),
          '중간 후보',
        ]),
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-yellow-500' }),
          '약한 후보',
        ]),
      ]),
    ]);
  },
});

const PhotoSlot = defineComponent({
  props: { title: { type: String, required: true }, help: { type: String, required: true }, image: { type: String, default: '' } },
  emits: ['picked', 'clear', 'open-camera'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    const emptyContent = () => [
      h(Upload, { size: 24, class: 'mb-2 text-gray-400' }),
      h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
      h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
    ];
    const isSurfaceSlot = () => props.title.includes('표면');
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
      props.image
        ? h('img', { src: props.image, alt: props.title, class: 'w-full h-full object-cover' })
        : isSurfaceSlot()
          ? h('button', { type: 'button', class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer', onClick: () => emit('open-camera') }, emptyContent())
          : h('label', { class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer' }, [
          ...emptyContent(),
          h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
        ]),
      isSurfaceSlot() ? h('button', { type: 'button', class: 'absolute bottom-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs', onClick: () => emit('open-camera') }, props.image ? '다시 촬영' : '촬영') : null,
      isSurfaceSlot() ? h('label', { class: 'absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs' }, [
        '파일 선택',
        h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
      ]) : null,
      props.image ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '변경') : null,
    ]);
  },
});

const VideoSlot = defineComponent({
  props: { title: { type: String, required: true }, help: { type: String, required: true }, video: { type: String, default: '' } },
  emits: ['picked', 'clear', 'open-camera'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
      props.video
        ? h('video', { src: props.video, controls: true, class: 'w-full h-full object-cover' })
        : h('button', { type: 'button', class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer', onClick: () => emit('open-camera') }, [
          h(Video, { size: 24, class: 'mb-2 text-gray-400' }),
          h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
          h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
        ]),
      h('label', { class: 'absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white' }, [
        '파일 선택',
        h('input', { type: 'file', accept: 'video/*', capture: 'environment', class: 'hidden', onChange }),
      ]),
      h('button', { type: 'button', class: 'absolute bottom-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs', onClick: () => emit('open-camera') }, props.video ? '다시 촬영' : '촬영'),
      props.video ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '변경') : null,
    ]);
  },
});

const AudioRecorder = defineComponent({
  props: {
    kind: { type: String, required: true },
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    isRecording: { type: Boolean, default: false },
    seconds: { type: Number, default: 0 },
    description: { type: String, required: true },
  },
  emits: ['start', 'stop', 'clear'],
  setup(props, { emit }) {
    const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const savedLabel = () => {
      if (props.kind === 'ambient') return '주변음 측정 완료';
      if (props.kind === 'good') return '좋은 구간 녹음 완료';
      return '안 좋은 구간 녹음 완료';
    };
    return () => h('div', { class: 'rounded-lg border p-3 space-y-3 bg-white' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: ['w-10 h-10 rounded-full flex items-center justify-center shrink-0', props.isRecording ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'] }, [h(Mic, { size: 20 })]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-sm truncate' }, props.name ? savedLabel() : props.description),
          h('p', { class: 'text-xs text-gray-500' }, props.isRecording ? `녹음 중 ${formatSeconds(props.seconds)}` : '기기 마이크로 바로 녹음합니다.'),
        ]),
        props.isRecording
          ? h('button', { type: 'button', class: 'px-3 py-2 rounded-lg bg-red-600 text-white text-xs', onClick: () => emit('stop') }, '정지')
          : h('button', { type: 'button', class: 'px-3 py-2 rounded-lg bg-blue-600 text-white text-xs', onClick: () => emit('start') }, props.name ? '다시 녹음' : '녹음'),
      ]),
      props.url ? h('div', { class: 'space-y-2' }, [
        h('audio', { src: props.url, controls: true, class: 'w-full' }),
        h('button', { type: 'button', class: 'text-xs text-gray-500 underline', onClick: () => emit('clear') }, '녹음 삭제'),
      ]) : null,
    ]);
  },
});
</script>
