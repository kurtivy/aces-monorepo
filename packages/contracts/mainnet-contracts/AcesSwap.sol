// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;


contract AcesSwap {
    using USDCMath for uint256;

    address private constant WETH = 0x4200000000000000000000000000000000000006;
    address private constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481; // Uniswap V3 Swap Router on Base
    address private constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // USDC on Base
    address private constant USDT = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2; // USDT on Base

    AcesInterface private acesCurves;    
    
    address private owner;
    bool private paused;

    event Log(string message);
    event Paused(address account);
    event Unpaused(address account);

    enum Curves {
        Quadratic,
        Linear,
        Sigmoid
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner, "Only owner can call this function");
    }

    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }

    function _whenNotPaused() internal view {
        require(!paused, "Contract is paused");
    }

    constructor(address _acesCurvesAddress) {
        acesCurves = AcesInterface(_acesCurvesAddress);

        owner = msg.sender;
        paused = false;
    }

    function pause() external onlyOwner {
        require(!paused, "Contract is already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Contract is already unpaused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    function updateCurvesAddress(address newCurvesAddress) external onlyOwner {
        require(newCurvesAddress != address(0), "Invalid curves address");
        acesCurves = AcesInterface(newCurvesAddress);
    }

    function getCurvesAddress() external view returns (address) {
        return address(acesCurves);
    }

    function sellUSDCAndBuyCurve(uint256 amountIn, uint256 amountOutMin, address roomOwner, uint256 roomNumber, uint256 amount) external whenNotPaused returns (bool success) {
        try IERC20(USDC).transferFrom(msg.sender, address(this), amountIn) {
            emit Log("transferFrom success");
        } catch {
            revert("Transfering tokens to contract failed");
        }

        try IERC20(USDC).approve(SWAP_ROUTER, amountIn) {
            emit Log("approve uniswap router success");
        } catch {
            revert("Approving tokens to router failed");
        }

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: USDC, // USDC is the input token
            tokenOut: WETH, // WETH is the output token
            fee: 500, // Fee tier (e.g., 500, 3000, or 10000)
            recipient: address(this), // The recipient of the USDC
            amountIn: amountIn, // Amount of USDC to swap
            amountOutMinimum: amountOutMin, // Minimum amount of Eth to receive
            sqrtPriceLimitX96: 0 // No price limit
        });

        // Perform the swap
        uint256 amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);

        IWETH(WETH).withdraw(amountOut);

        uint256 ethBalance = address(this).balance;

        // buy room with ETH
        uint256 buyPrice = acesCurves.getBuyPriceAfterFee(roomOwner, roomNumber, amount);
        require(ethBalance >= buyPrice, "Not enough ETH to buy room");

        try acesCurves.buySharesFor{value: buyPrice}(msg.sender, roomOwner, roomNumber, amount)
        {
            emit Log("buySharesFor success");
        } catch {
            revert("Buying shares failed");
        }

        uint256 ethBalanceAfterBuy = address(this).balance;

        if (ethBalanceAfterBuy > 0) {
            IWETH(WETH).deposit{value: ethBalanceAfterBuy}();

            uint256 wethBalance = IWETH(WETH).balanceOf(address(this));
    
            try IERC20(WETH).approve(SWAP_ROUTER, wethBalance) {
                emit Log("approve uniswap router success");
            } catch {
                revert("Approving tokens to router failed");
            }

            ISwapRouter.ExactInputSingleParams memory returnParams = ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH, // WETH is the input token
                tokenOut: USDC, // USDC is the output token
                fee: 500, // Fee tier (e.g., 500, 3000, or 10000)
                recipient: address(this), // The recipient of the USDC
                amountIn: wethBalance, // Amount of USDC to swap
                amountOutMinimum: 0, // Minimum amount of Eth to receive
                sqrtPriceLimitX96: 0 // No price limit
            });

            // Perform the swap
            uint256 amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(returnParams);
            
            IERC20(USDC).transfer(msg.sender, amountOut);
        }

        return true;
    }

    function sellUSDTAndBuyCurve(uint256 amountIn, uint256 amountOutMin, address roomOwner, uint256 roomNumber, uint256 amount) external whenNotPaused returns (bool success) {
        try IERC20(USDT).transferFrom(msg.sender, address(this), amountIn) {
            emit Log("transferFrom success");
        } catch {
            revert("Transfering tokens to contract failed");
        }

        try IERC20(USDT).approve(SWAP_ROUTER, amountIn) {
            emit Log("approve uniswap router success");
        } catch {
            revert("Approving tokens to router failed");
        }

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: USDT, // USDT is the input token
            tokenOut: WETH, // WETH is the output token
            fee: 500, // Fee tier (e.g., 500, 3000, or 10000)
            recipient: address(this), // The recipient of the USDT
            amountIn: amountIn, // Amount of USDT to swap
            amountOutMinimum: amountOutMin, // Minimum amount of Eth to receive
            sqrtPriceLimitX96: 0 // No price limit
        });

        // Perform the swap
        uint256 amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);

        IWETH(WETH).withdraw(amountOut);

        uint256 ethBalance = address(this).balance;

        // buy room with ETH
        uint256 buyPrice = acesCurves.getBuyPriceAfterFee(roomOwner, roomNumber, amount);
        require(ethBalance >= buyPrice, "Not enough ETH to buy room");

        try acesCurves.buySharesFor{value: buyPrice}(msg.sender, roomOwner, roomNumber, amount)
        {
            emit Log("buySharesFor success");
        } catch {
            revert("Buying shares failed");
        }

        uint256 ethBalanceAfterBuy = address(this).balance;

        if (ethBalanceAfterBuy > 0) {
            IWETH(WETH).deposit{value: ethBalanceAfterBuy}();

            uint256 wethBalance = IWETH(WETH).balanceOf(address(this));
    
            try IERC20(WETH).approve(SWAP_ROUTER, wethBalance) {
                emit Log("approve uniswap router success");
            } catch {
                revert("Approving tokens to router failed");
            }

            ISwapRouter.ExactInputSingleParams memory returnParams = ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH, // WETH is the input token
                tokenOut: USDT, // USDT is the output token
                fee: 500, // Fee tier (e.g., 500, 3000, or 10000)
                recipient: address(this), // The recipient of the USDT
                amountIn: wethBalance, // Amount of USDT to swap
                amountOutMinimum: 0, // Minimum amount of Eth to receive
                sqrtPriceLimitX96: 0 // No price limit
            });

            // Perform the swap
            uint256 amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(returnParams);
            
            IERC20(USDT).transfer(msg.sender, amountOut);
        }

        return true;
    }


    receive() external payable { }
    fallback() external payable { }
}

library USDCMath {
    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant WAD       = 1e18;
    uint256 internal constant USDC_TO_WAD = 1e12; // 1e18 / 1e6

    /// @notice Convert a USDC amount (6 dec) to 18-dec wad (floor).
    function toWad(uint256 usdcAmount) internal pure returns (uint256) {
        // safe in uint256 range: usdcAmount * 1e12 fits comfortably
        return usdcAmount * USDC_TO_WAD;
    }

    /// @notice Convert 18-dec wad to USDC (6 dec) with floor rounding.
    function fromWad(uint256 wadAmount) internal pure returns (uint256) {
        return wadAmount / USDC_TO_WAD;
    }

    /// @notice Round half up when converting wad->USDC.
    function fromWadRound(uint256 wadAmount) internal pure returns (uint256) {
        return (wadAmount + USDC_TO_WAD / 2) / USDC_TO_WAD;
    }
}

interface IWETH {
    function deposit() external payable;     // wrap: send ETH -> get WETH
    function withdraw(uint256) external;     // unwrap: burn WETH -> get ETH
    function transferFrom(address, address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface AcesInterface {
    function getSharesBalance(address sharesSubject, uint256 roomNumber, address holder) external view returns (uint256);
    function getSellPriceAfterFee(address sharesSubject, uint256 roomNumber, uint256 amount) external view returns (uint256 price);
    function getBuyPriceAfterFee(address sharesSubject, uint256 roomNumber, uint256 amount) external view returns (uint256 price);
    function buyShares(address sharesSubject, uint256 roomNumber, uint256 amount) external payable;
    function buySharesFor(address buyer, address sharesSubject, uint256 roomNumber, uint256 amount) external payable;
}


interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}