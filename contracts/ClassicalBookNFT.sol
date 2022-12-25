// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import '@openzeppelin/contracts/security/PullPayment.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract ClassicalBookNFT is ERC721, Ownable, ReentrancyGuard, PullPayment {
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;

    using EnumerableSet for EnumerableSet.AddressSet;

    // Constants
    uint256 public maxSupply = 1;
    // mint price
    uint256 public mintPrice = 0.2 ether;

    /// @dev Base token URI used as a prefix by tokenURI().
    string private baseTokenURI;
    // switch mint
    bool public isMintEnabled = true;
    /// store tokenid --> bookId
    mapping(uint256 => string) public tokenToBook;
    // used for switch mint
    EnumerableSet.AddressSet private whitelist;

    modifier onlyWhitelist() {
        require(whitelist.contains(_msgSender()), "not in whitelist!");
        _;
    }

    event Mint(address indexed user, uint256 indexed tokenId, string bookId);
    event AddToWhitelist(address _addr);
    event RemoveFromWhitelist(address _addr);
    event SetMintPrice(uint256 price);

    // name and symbol
    constructor(string memory baseUri) ERC721("Classical Book NFT Collectioin", "ClassicalBook") {
        //drop 0
        currentTokenId.increment();
        baseTokenURI = baseUri;
    }

    function toggleIsMintEnabled() external onlyWhitelist {
        isMintEnabled = !isMintEnabled;
    }
    
    /// the lowest price is 1e15 Wei
    function setMintPrice(uint256 newPriceUnit) external onlyOwner {
        mintPrice = newPriceUnit * 1e15;
        emit SetMintPrice(newPriceUnit);
    }

    function mintTo(address recipient, string memory bookId)
        public
        payable
        nonReentrant
        returns (uint256)
    {
        require(isMintEnabled, 'Minting not enabled');
        require(msg.value == mintPrice, "Please set the right value");
  
        uint256 tokenId = currentTokenId.current();
        require(tokenId <= maxSupply, "Max supply reached");
        //transfer eth to the contract
        _asyncTransfer(address(this), msg.value);
        // mint nft
        _safeMint(recipient, tokenId);
        // tokenId ++
        currentTokenId.increment();
        tokenToBook[tokenId] = bookId;
        emit Mint(recipient, tokenId, bookId);
        return tokenId;
    }

    /// @dev Returns an URI for a given token ID
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /// @dev Sets the base token URI prefix.
    function setBaseTokenURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /// Sets max supply, one book one nft
    function setMaxSupply(uint256 _maxSupply) public onlyOwner {
        uint256 tokenId = currentTokenId.current();
        require(_maxSupply > tokenId, "Must greate than current token id");
        maxSupply = _maxSupply;
    }

    /**
     * @dev See {IERC721Enumerable-totalSupply}.
     */
    function totalSupply() public view returns (uint256) {
        uint256 tokenId = currentTokenId.current();
        return tokenId;
    }

    /// @dev Overridden in order to make it an onlyOwner function
    function withdrawPayments(address payable payee)
        public
        virtual
        override
        onlyOwner
    {
        super.withdrawPayments(payee);
    }

    /**
     * @notice set whitelist
     * @param _addrArr new address array
     */
    function addToWhitelist(address[] calldata _addrArr) external onlyOwner {
        for (uint256 i; i < _addrArr.length; i++) {
            require(whitelist.add(_addrArr[i]), "add to whitelist failed!");
            emit AddToWhitelist(_addrArr[i]);
        }
    }

    function removeFromWhitelist(address[] calldata _addrArr)
        external
        onlyOwner
    {
        for (uint256 i; i < _addrArr.length; i++) {
            require(
                whitelist.remove(_addrArr[i]),
                "remove from whitelist failed!"
            );
            emit RemoveFromWhitelist(_addrArr[i]);
        }
    }

    function getWhitelist() external view returns (address[] memory addresses) {
        return whitelist.values();
    }

}
