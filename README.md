# Neverlose.money - Gamified HODL Protocol
A lock-up smart contract HODL protocol on Ethereum that pays bonus to the winners with the losers penalty.

> "If you aren’t willing to own a stock for ten years, don’t even think about owning it for ten minutes."\
>\- Warren Buffet -

![](https://rukminim1.flixcart.com/image/832/832/j6v2ky80/poster/s/r/h/small-warren-buffett-motivational-quotes-value-investing-rule-no-original-imaex8tz68kyz2hf.jpeg)

Source: https://youtu.be/vCpT-UmVf3g

## Contracts
### LockUpPool.sol
A lock-up smart contract that pays bonus to the winners with the losers' penalty when they break lock-up prematurely.

### WRNRewardPool.sol
A governance token distribution contract on top of LockUpPool. A maximum of 1.2M WRN tokens will be distributed for 4 years depending on users' contribution to the lockup pool

#### Boost Factor
1. Token Amount: Linear
2. Lock-up period: 1x (3 months) - 40x (10 years)
3. Pool multiplier: 2x (HUNT), 1x (WETH), 1x (WBTC)

## Görli (goerli) Testnet
- ETH faucet (to pay gas): https://faucet.goerli.mudit.blog/
- Lock-up contract: [0x8f62599Ce9E93Cda072EA4F4E86dbaBF3CCC2bC9](https://goerli.etherscan.io/address/0x8f62599Ce9E93Cda072EA4F4E86dbaBF3CCC2bC9)
- Test tokens
  - WRN: 0xdAecEce4b065595907F04b8a9C96A9B7929Ee626
  - HUNT: 0xD409b07cC381c3D831F7fD71C4141c86DdC2a5c6
  - WETH: 0x608f8CeB3Af57Dd3b56b480B51dcfd7E7096acA3
  - WBTC: 0x48A32932F3BD2Fd7Bb31c97570290dE9d1e8827C

## Gas consumption
```
·------------------------------------------------|---------------------------|--------------|----------------------------·
|      Solc version: 0.7.1+commit.f4a555be       ·  Optimizer enabled: true  ·  Runs: 1500  ·  Block limit: 6718946 gas  │
·················································|···························|··············|·····························
|  Methods                                       ·               25 gwei/gas                ·       495.45 usd/eth       │
························|························|·············|·············|··············|··············|··············
|  Contract             ·  Method                ·  Min        ·  Max        ·  Avg         ·  # calls     ·  usd (avg)  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  addMinter             ·      72815  ·      75612  ·       73164  ·          34  ·       0.91  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  approve               ·      29070  ·      46897  ·       43988  ·         133  ·       0.54  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  initialize            ·     324430  ·     369343  ·      356342  ·         104  ·       4.41  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  mint                  ·          -  ·          -  ·       52871  ·          51  ·       0.65  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  transfer              ·      37081  ·      52141  ·       51421  ·          21  ·       0.64  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  addLockUpPool         ·      71227  ·      86311  ·       84684  ·          37  ·       1.05  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  claimBonus            ·      26634  ·     105197  ·       64009  ·           3  ·       0.79  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  doLockUp              ·     185088  ·     350039  ·      297644  ·          46  ·       3.69  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  exit                  ·      58250  ·     207065  ·      134293  ·          31  ·       1.66  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  initialize            ·          -  ·          -  ·      116378  ·          31  ·       1.44  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  setEmergencyMode      ·          -  ·          -  ·       28217  ·           4  ·       0.35  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  updateMaxLimit        ·      28764  ·      28836  ·       28800  ·           2  ·       0.36  │
························|························|·············|·············|··············|··············|··············
|  Migrations           ·  setCompleted          ·          -  ·          -  ·       21204  ·           5  ·       0.26  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  addLockUpRewardPool   ·     101166  ·     224459  ·      121603  ·          41  ·       1.51  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  claimWRN              ·     146854  ·     202654  ·      184054  ·           6  ·       2.28  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  claimWRNandBonus      ·          -  ·          -  ·      200393  ·           1  ·       2.48  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  doLockUp              ·     304635  ·     422522  ·      391213  ·          32  ·       4.85  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  exit                  ·     159193  ·     290449  ·      250260  ·           8  ·       3.10  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  initialize            ·     241834  ·     241954  ·      241873  ·          30  ·       3.00  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  setEmergencyMode      ·          -  ·          -  ·       28218  ·           1  ·       0.35  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  updatePoolMultiplier  ·          -  ·          -  ·      223728  ·           1  ·       2.77  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPoolV2Test  ·  setVarAdded           ·          -  ·          -  ·       44269  ·           2  ·       0.55  │
························|························|·············|·············|··············|··············|··············
|  Deployments                                   ·                                          ·  % of limit  ·             │
·················································|·············|·············|··············|··············|··············
|  ERC20Token                                    ·          -  ·          -  ·     1926451  ·      28.7 %  ·      23.86  │
·················································|·············|·············|··············|··············|··············
|  LockUpPool                                    ·          -  ·          -  ·     1950515  ·        29 %  ·      24.16  │
·················································|·············|·············|··············|··············|··············
|  WRNRewardPool                                 ·          -  ·          -  ·     2696051  ·      40.1 %  ·      33.39  │
·------------------------------------------------|-------------|-------------|--------------|--------------|-------------·
```
