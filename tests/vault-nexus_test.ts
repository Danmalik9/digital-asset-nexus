import { Clarinet, Tx, Chain, Account, types } from "https://deno.land/x/clarinet@v1.0.0/index.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test constants - vendor and buyer addresses
const VENDOR_PRINCIPAL = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";
const BUYER_PRINCIPAL = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
const THIRD_PARTY = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";

// Asset test data
const TEST_ASSET_NAME = "Professional UI Kit";
const TEST_METADATA = "Comprehensive collection of reusable components";
const TEST_COST = types.uint(5000000);
const TEST_SECTOR = "design";
const TEST_THUMBNAIL = "https://cdn.example.com/thumb.jpg";
const TEST_RESOURCE = "https://cdn.example.com/full.zip";
const TEST_ROYALTY = types.uint(10);

Clarinet.test({
  name: "Asset registry - successfully register new asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    
    const result = chain.callReadOnly("vault-nexus", "count-registered-assets", [], vendor.address);
    assertEquals(result.result, "(u0)");

    const registerResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    assertEquals(registerResult.receipts.length, 1);
    assertEquals(registerResult.receipts[0].result, "(ok u1)");
  },
});

Clarinet.test({
  name: "Asset registration - rejects zero price",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    const registerResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii("Bad Asset"),
        types.utf8("No cost"),
        types.uint(0),
        types.ascii("design"),
        types.utf8("thumb"),
        types.utf8("resource"),
        types.uint(5),
      ], vendor.address),
    ]);

    assertEquals(registerResult.receipts[0].result, "(err u105)");
  },
});

Clarinet.test({
  name: "Royalty validation - rejects excessive royalty rates",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    const registerResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii("High Royalty Asset"),
        types.utf8("Description"),
        types.uint(1000000),
        types.ascii("media"),
        types.utf8("thumb"),
        types.utf8("full"),
        types.uint(20),
      ], vendor.address),
    ]);

    assertEquals(registerResult.receipts[0].result, "(err u106)");
  },
});

Clarinet.test({
  name: "Asset retrieval - fetch registered asset details",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const fetchResult = chain.callReadOnly("vault-nexus", "fetch-asset", [
      types.uint(1),
    ], vendor.address);

    assertEquals(fetchResult.result.includes("vendor"), true);
    assertEquals(fetchResult.result.includes("name"), true);
  },
});

Clarinet.test({
  name: "Asset modification - authorized vendor updates asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const updateResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "modify-asset", [
        types.uint(1),
        types.ascii("Updated Name"),
        types.utf8("New description"),
        types.uint(6000000),
        types.ascii("templates"),
        types.utf8("new-thumb"),
        types.utf8("new-resource"),
        types.bool(true),
      ], vendor.address),
    ]);

    assertEquals(updateResult.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Asset modification - unauthorized user rejected",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const otherUser = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const updateResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "modify-asset", [
        types.uint(1),
        types.ascii("Hacked Name"),
        types.utf8("Malicious"),
        types.uint(10000000),
        types.ascii("other"),
        types.utf8("hacked"),
        types.utf8("hacked"),
        types.bool(true),
      ], otherUser.address),
    ]);

    assertEquals(updateResult.receipts[0].result, "(err u100)");
  },
});

Clarinet.test({
  name: "Asset deactivation - vendor removes listing",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const deactivateResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "deactivate-asset", [
        types.uint(1),
      ], vendor.address),
    ]);

    assertEquals(deactivateResult.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Asset acquisition - buyer purchases asset successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const acquireResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    assertEquals(acquireResult.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Asset acquisition - vendor cannot purchase own asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const acquireResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], vendor.address),
    ]);

    assertEquals(acquireResult.receipts[0].result, "(err u100)");
  },
});

Clarinet.test({
  name: "Duplicate purchase - buyer cannot repurchase asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const secondPurchaseResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    assertEquals(secondPurchaseResult.receipts[0].result, "(err u104)");
  },
});

Clarinet.test({
  name: "Inactive asset - cannot purchase deactivated asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "deactivate-asset", [
        types.uint(1),
      ], vendor.address),
    ]);

    const acquireResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    assertEquals(acquireResult.receipts[0].result, "(err u102)");
  },
});

Clarinet.test({
  name: "Feedback submission - buyer rates purchased asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const feedbackResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "post-feedback", [
        types.uint(1),
        types.uint(5),
        types.utf8("Excellent asset, very professional!"),
      ], buyer.address),
    ]);

    assertEquals(feedbackResult.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Feedback validation - rejects invalid rating score",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const feedbackResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "post-feedback", [
        types.uint(1),
        types.uint(10),
        types.utf8("Invalid rating"),
      ], buyer.address),
    ]);

    assertEquals(feedbackResult.receipts[0].result, "(err u107)");
  },
});

Clarinet.test({
  name: "Feedback duplicates - cannot submit multiple ratings",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "post-feedback", [
        types.uint(1),
        types.uint(4),
        types.utf8("Good asset"),
      ], buyer.address),
    ]);

    const secondFeedbackResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "post-feedback", [
        types.uint(1),
        types.uint(5),
        types.utf8("Actually it is excellent!"),
      ], buyer.address),
    ]);

    assertEquals(secondFeedbackResult.receipts[0].result, "(err u109)");
  },
});

Clarinet.test({
  name: "Feedback authorization - only buyers can submit ratings",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;
    const unauthorized = accounts.get("wallet_2")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const feedbackResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "post-feedback", [
        types.uint(1),
        types.uint(3),
        types.utf8("Trying to rate without purchase"),
      ], unauthorized.address),
    ]);

    assertEquals(feedbackResult.receipts[0].result, "(err u108)");
  },
});

Clarinet.test({
  name: "Asset relisting - previous buyer can relist acquired asset",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const relistResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "relist-asset", [
        types.uint(1),
        types.uint(1500000),
      ], buyer.address),
    ]);

    assertEquals(relistResult.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Asset relisting - validates price",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const relistResult = chain.mineBlock([
      Tx.contractCall("vault-nexus", "relist-asset", [
        types.uint(1),
        types.uint(0),
      ], buyer.address),
    ]);

    assertEquals(relistResult.receipts[0].result, "(err u105)");
  },
});

Clarinet.test({
  name: "Asset counter - tracks registered assets",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;

    const initialCount = chain.callReadOnly("vault-nexus", "count-registered-assets", [], vendor.address);
    assertEquals(initialCount.result, "(u0)");

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        TEST_COST,
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const afterFirstAsset = chain.callReadOnly("vault-nexus", "count-registered-assets", [], vendor.address);
    assertEquals(afterFirstAsset.result, "(u1)");

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii("Second Asset"),
        types.utf8("Another one"),
        types.uint(2000000),
        types.ascii("templates"),
        types.utf8("thumb2"),
        types.utf8("full2"),
        types.uint(5),
      ], vendor.address),
    ]);

    const afterSecondAsset = chain.callReadOnly("vault-nexus", "count-registered-assets", [], vendor.address);
    assertEquals(afterSecondAsset.result, "(u2)");
  },
});

Clarinet.test({
  name: "Verify acquisition - check purchase history",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const vendor = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "register-asset", [
        types.ascii(TEST_ASSET_NAME),
        types.utf8(TEST_METADATA),
        types.uint(1000000),
        types.ascii(TEST_SECTOR),
        types.utf8(TEST_THUMBNAIL),
        types.utf8(TEST_RESOURCE),
        TEST_ROYALTY,
      ], vendor.address),
    ]);

    const beforePurchase = chain.callReadOnly("vault-nexus", "verify-acquisition", [
      types.uint(1),
      types.principal(buyer.address),
    ], vendor.address);
    assertEquals(beforePurchase.result, "false");

    chain.mineBlock([
      Tx.contractCall("vault-nexus", "acquire-asset", [
        types.uint(1),
      ], buyer.address),
    ]);

    const afterPurchase = chain.callReadOnly("vault-nexus", "verify-acquisition", [
      types.uint(1),
      types.principal(buyer.address),
    ], vendor.address);
    assertEquals(afterPurchase.result, "true");
  },
});
