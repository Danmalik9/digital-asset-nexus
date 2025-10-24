;; vault-nexus.clar
;; Digital Asset Nexus - Decentralized marketplace for digital assets
;; Enables secure trading, ownership tracking, and reputation management
;; on the Stacks blockchain.

;; Error codes for contract operations
(define-constant fail-unauthorized (err u100))
(define-constant fail-asset-missing (err u101))
(define-constant fail-asset-inactive (err u102))
(define-constant fail-insufficient-balance (err u103))
(define-constant fail-duplicate-transaction (err u104))
(define-constant fail-bad-price (err u105))
(define-constant fail-bad-royalty (err u106))
(define-constant fail-bad-rating (err u107))
(define-constant fail-no-prior-purchase (err u108))
(define-constant fail-rating-exists (err u109))
(define-constant fail-fee-payment (err u110))
(define-constant fail-royalty-payment (err u111))
(define-constant fail-vendor-payment (err u112))

;; Platform settings and constraints
(define-constant ADMIN tx-sender)
(define-constant PLATFORM-RATE u5)
(define-constant ROYALTY-CAP u15)
(define-constant RATING-MAX u5)
;; Asset registry - stores all registered digital assets
(define-map asset-registry
  { asset-id: uint }
  {
    vendor: principal,
    name: (string-ascii 100),
    metadata: (string-utf8 500),
    cost: uint,
    sector: (string-ascii 50),
    thumbnail-uri: (string-utf8 200),
    resource-uri: (string-utf8 200),
    royalty-share: uint,
    active-status: bool,
  }
)

;; Transaction log tracking all exchanges
(define-map transactions
  {
    asset-id: uint,
    acquirer: principal,
  }
  {
    timestamp: uint,
    cost: uint,
    rated: bool,
  }
)

;; Historical ledger of all owners
(define-map owner-ledger
  {
    asset-id: uint,
    seq: uint,
  }
  {
    principal-addr: principal,
    date-acquired: uint,
    amount-paid: uint,
  }
)

;; Feedback entries from purchasers
(define-map feedback
  {
    asset-id: uint,
    evaluator: principal,
  }
  {
    rating: uint,
    text: (string-utf8 300),
    timestamp: uint,
  }
)

;; Market velocity index by category and period
(define-map market-velocity
  {
    sector: (string-ascii 50),
    period-key: (string-ascii 7),
  }
  { transaction-volume: uint }
)

;; ID counter for asset registry
(define-data-var asset-counter uint u0)

;; Owner ledger sequence tracker
(define-map owner-sequence
  { asset-id: uint }
  { next-seq: uint }
)
;; Generate next asset identifier
(define-private (generate-asset-id)
  (let ((id (+ (var-get asset-counter) u1)))
    (var-set asset-counter id)
    id
  )
)

;; Query current block height for timestamp
(define-private (fetch-block-timestamp)
  block-height
)

;; Compute platform commission
(define-private (calc-platform-commission (amount uint))
  (/ (* amount PLATFORM-RATE) u100)
)

;; Compute secondary payment
(define-private (calc-secondary-payment
    (amount uint)
    (rate uint)
  )
  (/ (* amount rate) u100)
)

;; Format time period identifier
(define-private (format-period-id)
  (concat "?" "?")
)

;; Retrieve or initialize owner sequence
(define-private (resolve-owner-seq (asset-id uint))
  (default-to { next-seq: u0 }
    (map-get? owner-sequence { asset-id: asset-id })
  )
)

;; Register ownership change
(define-private (log-ownership
    (asset-id uint)
    (new-proprietor principal)
    (amount uint)
  )
  (let (
      (seq-info (resolve-owner-seq asset-id))
      (current-seq (get next-seq seq-info))
      (new-seq (+ current-seq u1))
    )
    (map-set owner-ledger {
      asset-id: asset-id,
      seq: new-seq,
    } {
      principal-addr: new-proprietor,
      date-acquired: (fetch-block-timestamp),
      amount-paid: amount,
    })
    (map-set owner-sequence { asset-id: asset-id } { next-seq: new-seq })
  )
)

;; Update market activity metrics
(define-private (record-market-activity (sector (string-ascii 50)))
  (let (
      (period-key (format-period-id))
      (current-metrics (default-to { transaction-volume: u0 }
        (map-get? market-velocity {
          sector: sector,
          period-key: period-key,
        })
      ))
    )
    (map-set market-velocity {
      sector: sector,
      period-key: period-key,
    } { transaction-volume: (+ u1 (get transaction-volume current-metrics)) }
    )
  )
)

;; Register new asset for trade
(define-public (register-asset
    (name (string-ascii 100))
    (metadata (string-utf8 500))
    (cost uint)
    (sector (string-ascii 50))
    (thumbnail-uri (string-utf8 200))
    (resource-uri (string-utf8 200))
    (royalty-share uint)
  )
  (let ((asset-id (generate-asset-id)))
    ;; Validate parameters
    (asserts! (> cost u0) fail-bad-price)
    (asserts! (<= royalty-share ROYALTY-CAP) fail-bad-royalty)
    ;; Store asset in registry
    (map-set asset-registry { asset-id: asset-id } {
      vendor: tx-sender,
      name: name,
      metadata: metadata,
      cost: cost,
      sector: sector,
      thumbnail-uri: thumbnail-uri,
      resource-uri: resource-uri,
      royalty-share: royalty-share,
      active-status: true,
    })
    ;; Initialize ownership ledger
    (map-set owner-ledger {
      asset-id: asset-id,
      seq: u0,
    } {
      principal-addr: tx-sender,
      date-acquired: (fetch-block-timestamp),
      amount-paid: u0,
    })
    ;; Initialize sequence counter
    (map-set owner-sequence { asset-id: asset-id } { next-seq: u0 })
    (ok asset-id)
  )
)

;; Modify asset properties
(define-public (modify-asset
    (asset-id uint)
    (name (string-ascii 100))
    (metadata (string-utf8 500))
    (cost uint)
    (sector (string-ascii 50))
    (thumbnail-uri (string-utf8 200))
    (resource-uri (string-utf8 200))
    (status bool)
  )
  (let ((asset (unwrap! (map-get? asset-registry { asset-id: asset-id }) fail-asset-missing)))
    ;; Require vendor authorization
    (asserts! (is-eq tx-sender (get vendor asset)) fail-unauthorized)
    (asserts! (> cost u0) fail-bad-price)
    ;; Update asset record
    (map-set asset-registry { asset-id: asset-id }
      (merge asset {
        name: name,
        metadata: metadata,
        cost: cost,
        sector: sector,
        thumbnail-uri: thumbnail-uri,
        resource-uri: resource-uri,
        active-status: status,
      })
    )
    (ok true)
  )
)

;; Deactivate asset from marketplace
(define-public (deactivate-asset (asset-id uint))
  (let ((asset (unwrap! (map-get? asset-registry { asset-id: asset-id }) fail-asset-missing)))
    ;; Require vendor authorization
    (asserts! (is-eq tx-sender (get vendor asset)) fail-unauthorized)
    ;; Update asset to inactive
    (map-set asset-registry { asset-id: asset-id }
      (merge asset { active-status: false })
    )
    (ok true)
  )
)

;; Execute asset acquisition transaction
(define-public (acquire-asset (asset-id uint))
  (let (
      (asset (unwrap! (map-get? asset-registry { asset-id: asset-id })
        fail-asset-missing
      ))
      (buyer tx-sender)
      (proprietor (get vendor asset))
      (amount (get cost asset))
      (sector (get sector asset))
      (platform-fee (calc-platform-commission amount))
      (proprietor-proceeds (- amount platform-fee))
    )
    ;; Validate transaction preconditions
    (asserts! (get active-status asset) fail-asset-inactive)
    (asserts! (not (is-eq buyer proprietor)) fail-unauthorized)
    (asserts!
      (is-none (map-get? transactions {
        asset-id: asset-id,
        acquirer: buyer,
      }))
      fail-duplicate-transaction
    )
    ;; Process platform commission payment
    (unwrap! (stx-transfer? platform-fee buyer ADMIN)
      fail-fee-payment
    )
    ;; Process proprietor compensation
    (unwrap! (stx-transfer? proprietor-proceeds buyer proprietor) fail-vendor-payment)
    ;; Document the transaction
    (map-set transactions {
      asset-id: asset-id,
      acquirer: buyer,
    } {
      timestamp: (fetch-block-timestamp),
      cost: amount,
      rated: false,
    })
    ;; Log ownership shift
    (log-ownership asset-id buyer amount)
    ;; Record market activity
    (record-market-activity sector)
    (ok true)
  )
)

;; Post evaluative feedback on acquired asset
(define-public (post-feedback
    (asset-id uint)
    (rating uint)
    (text (string-utf8 300))
  )
  (let (
      (asset (unwrap! (map-get? asset-registry { asset-id: asset-id })
        fail-asset-missing
      ))
      (transaction (unwrap!
        (map-get? transactions {
          asset-id: asset-id,
          acquirer: tx-sender,
        })
        fail-no-prior-purchase
      ))
    )
    ;; Validate feedback parameters
    (asserts! (not (get rated transaction)) fail-rating-exists)
    (asserts! (<= rating RATING-MAX) fail-bad-rating)
    ;; Store feedback entry
    (map-set feedback {
      asset-id: asset-id,
      evaluator: tx-sender,
    } {
      rating: rating,
      text: text,
      timestamp: (fetch-block-timestamp),
    })
    ;; Update transaction state
    (map-set transactions {
      asset-id: asset-id,
      acquirer: tx-sender,
    }
      (merge transaction { rated: true })
    )
    (ok true)
  )
)

;; List previously acquired asset for secondary market
(define-public (relist-asset
    (asset-id uint)
    (new-cost uint)
  )
  (let (
      (asset (unwrap! (map-get? asset-registry { asset-id: asset-id })
        fail-asset-missing
      ))
      (transaction (unwrap!
        (map-get? transactions {
          asset-id: asset-id,
          acquirer: tx-sender,
        })
        fail-no-prior-purchase
      ))
    )
    ;; Validate relisting parameters
    (asserts! (> new-cost u0) fail-bad-price)
    ;; Update asset with new proprietor and cost
    (map-set asset-registry { asset-id: asset-id }
      (merge asset {
        vendor: tx-sender,
        cost: new-cost,
        active-status: true,
      })
    )
    (ok true)
  )
)

;; Retrieve asset information
(define-read-only (fetch-asset (asset-id uint))
  (map-get? asset-registry { asset-id: asset-id })
)

;; Verify ownership history
(define-read-only (verify-acquisition
    (asset-id uint)
    (subject principal)
  )
  (is-some (map-get? transactions {
    asset-id: asset-id,
    acquirer: subject,
  }))
)

;; Query feedback data
(define-read-only (query-feedback
    (asset-id uint)
    (subject principal)
  )
  (map-get? feedback {
    asset-id: asset-id,
    evaluator: subject,
  })
)

;; Retrieve market velocity metrics
(define-read-only (read-market-metrics
    (sector (string-ascii 50))
    (period-key (string-ascii 7))
  )
  (default-to { transaction-volume: u0 }
    (map-get? market-velocity {
      sector: sector,
      period-key: period-key,
    })
  )
)

;; Access ownership ledger entry
(define-read-only (fetch-owner-record
    (asset-id uint)
    (seq uint)
  )
  (map-get? owner-ledger {
    asset-id: asset-id,
    seq: seq,
  })
)

;; Report total assets registered
(define-read-only (count-registered-assets)
  (var-get asset-counter)
)
