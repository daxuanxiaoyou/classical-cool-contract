// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract ClassicalBookNFT is ERC721, Ownable, ReentrancyGuard, PullPayment {
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;

    using EnumerableSet for EnumerableSet.AddressSet;

    // Constants
    uint256 public maxSupply = 99;
    // mint price
    uint256 public mintPrice = 0.0002 ether;

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

    event MintEvent(
        address indexed user,
        uint256 indexed tokenId,
        string bookId
    );
    event SetMintPrice(uint256 price);

    // name and symbol
    constructor() ERC721("Classical Book NFT Collectioin", "ClassicalBook") {
        //drop 0
        currentTokenId.increment();
    }

    function toggleIsMintEnabled() external onlyWhitelist {
        isMintEnabled = !isMintEnabled;
    }

    /// the lowest price is 1e15 Wei
    function setMintPrice(uint256 newPriceUnit) external onlyOwner {
        mintPrice = newPriceUnit * 1e15;
        emit SetMintPrice(newPriceUnit);
    }

    function mint(address recipient, string memory bookId)
        public
        payable
        nonReentrant
        returns (uint256)
    {
        require(isMintEnabled, "Minting not enabled");
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
        emit MintEvent(recipient, tokenId, bookId);
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

    function addToWhitelist(address[] calldata _addrArr) external onlyOwner {
        for (uint256 i = 0; i < _addrArr.length; i++) {
            require(whitelist.add(_addrArr[i]), "Add whitelist failed!");
        }
    }

    function removeFromWhitelist(address[] calldata _addrArr)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < _addrArr.length; i++) {
            require(whitelist.remove(_addrArr[i]), "Remove whitelist failed!");
        }
    }

    function getWhitelist() external view returns (address[] memory) {
        return whitelist.values();
    }
}
