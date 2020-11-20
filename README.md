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
- Lock-up contract: 0x8f62599Ce9E93Cda072EA4F4E86dbaBF3CCC2bC9
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
|  Methods                                       ·               25 gwei/gas                ·       484.30 usd/eth       │
························|························|·············|·············|··············|··············|··············
|  Contract             ·  Method                ·  Min        ·  Max        ·  Avg         ·  # calls     ·  usd (avg)  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  addMinter             ·      72827  ·      75612  ·       73098  ·          32  ·       0.89  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  approve               ·      29070  ·      46897  ·       43962  ·         129  ·       0.53  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  initialize            ·     324430  ·     369343  ·      356528  ·         102  ·       4.32  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  mint                  ·          -  ·          -  ·       52871  ·          49  ·       0.64  │
························|························|·············|·············|··············|··············|··············
|  ERC20Token           ·  transfer              ·      37081  ·      52141  ·       51421  ·          21  ·       0.62  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  addLockUpPool         ·      71215  ·      86311  ·       84684  ·          37  ·       1.03  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  claimBonus            ·      26634  ·     105197  ·       64009  ·           3  ·       0.77  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  doLockUp              ·     185088  ·     350039  ·      297643  ·          46  ·       3.60  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  exit                  ·      58256  ·     207065  ·      134292  ·          31  ·       1.63  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  initialize            ·          -  ·          -  ·      116378  ·          31  ·       1.41  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  setEmergencyMode      ·          -  ·          -  ·       28217  ·           4  ·       0.34  │
························|························|·············|·············|··············|··············|··············
|  LockUpPool           ·  updateMaxLimit        ·      28764  ·      28836  ·       28800  ·           2  ·       0.35  │
························|························|·············|·············|··············|··············|··············
|  Migrations           ·  setCompleted          ·          -  ·          -  ·       21204  ·           5  ·       0.26  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  addLockUpRewardPool   ·     101166  ·     224459  ·      121812  ·          39  ·       1.47  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  claimWRN              ·     146843  ·     202655  ·      184051  ·           6  ·       2.23  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  doLockUp              ·     304647  ·     422522  ·      390196  ·          30  ·       4.72  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  exit                  ·     159206  ·     290450  ·      245126  ·           7  ·       2.97  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  initialize            ·     241822  ·     241954  ·      241873  ·          29  ·       2.93  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  setEmergencyMode      ·          -  ·          -  ·       28218  ·           1  ·       0.34  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPool        ·  updatePoolMultiplier  ·          -  ·          -  ·      223728  ·           1  ·       2.71  │
························|························|·············|·············|··············|··············|··············
|  WRNRewardPoolV2Test  ·  setVarAdded           ·          -  ·          -  ·       44247  ·           1  ·       0.54  │
························|························|·············|·············|··············|··············|··············
|  Deployments                                   ·                                          ·  % of limit  ·             │
·················································|·············|·············|··············|··············|··············
|  ERC20Token                                    ·          -  ·          -  ·     1926451  ·      28.7 %  ·      23.32  │
·················································|·············|·············|··············|··············|··············
|  LockUpPool                                    ·          -  ·          -  ·     1950515  ·        29 %  ·      23.62  │
·················································|·············|·············|··············|··············|··············
|  WRNRewardPool                                 ·          -  ·          -  ·     2677676  ·      39.9 %  ·      32.42  │
·················································|·············|·············|··············|··············|··············
|  WRNRewardPoolV2Test                           ·          -  ·          -  ·     2446820  ·      36.4 %  ·      29.62  │
·------------------------------------------------|-------------|-------------|--------------|--------------|-------------·
```
