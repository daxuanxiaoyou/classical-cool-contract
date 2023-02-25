// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ClassicalBookNFT is ERC721, AccessControl, ReentrancyGuard, PullPayment {
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;
    Counters.Counter private reserveTokenId;

    // roles
    // DEFAULT_ADMIN_ROLE = 0x00
    bytes32 public constant SWITCH_MINT_ROLE = keccak256("SWITCH_MINT_ROLE");
    bytes32 public constant FREE_MINT_ROLE = keccak256("FREE_MINT_ROLE");

    uint256 public constant reserveTokens = 100;
    uint256 public currentSupply = 0;

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

    modifier onlyWhiteList() {
        _checkRole(FREE_MINT_ROLE);
        _;
    }

    modifier onlySwitchRole() {
        _checkRole(SWITCH_MINT_ROLE);
        _;
    }

    modifier onlyOwner() {
        _checkRole(DEFAULT_ADMIN_ROLE);
        _;
    }

    event MintEvent(
        address indexed user,
        uint256 indexed tokenId,
        string bookId
    );
    event SetMintPrice(uint256 indexed price);

    // name and symbol
    constructor() ERC721("Classical Book NFT Collectioin", "ClassicalBook") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SWITCH_MINT_ROLE, msg.sender);
    }

    //set addresses to whiteList
    function addToWhitelist(address[] calldata _addrArr) external onlyOwner {
        for (uint256 i = 0; i < _addrArr.length; i++) {
            _grantRole(FREE_MINT_ROLE, _addrArr[i]);
        }
    }

    //remove addresses to whiteList
    function removeFromWhitelist(address[] calldata _addrArr) external onlyOwner
    {
        for (uint256 i = 0; i < _addrArr.length; i++) {
            _revokeRole(FREE_MINT_ROLE, _addrArr[i]);
        }
    }

    //set address to switchList
    function addToSwitchlist(address _switchAddress) external onlyOwner {
        _grantRole(SWITCH_MINT_ROLE, _switchAddress);
    }
    //remove address from switchList
    function removeFromSwitchList(address _switchAddress) external onlyOwner {
        _revokeRole(SWITCH_MINT_ROLE, _switchAddress);
    }

    //transfer admin
    function transferAdmin(address _newAdmin) external onlyOwner {
        //first grantRole
        _grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        //then revoke self
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    //swith mintable
    function toggleIsMintEnabled() external onlySwitchRole {
        isMintEnabled = !isMintEnabled;
    }

    /// the lowest price is 1e15 Wei
    function setMintPrice(uint256 _newPriceUnit) external onlyOwner {
        mintPrice = _newPriceUnit * 1e15;
        emit SetMintPrice(mintPrice);
    }

    function mint(address _recipient, string memory _bookId)
        public
        payable
        nonReentrant
        returns (uint256)
    {
        require(isMintEnabled, "Minting not enabled");
        require(currentSupply <= maxSupply, "Max supply reached");

        // tokenId ++
        currentTokenId.increment();
        // reserve 100 NFTs from 1 ~ 100 
        uint256 tokenId = currentTokenId.current() + reserveTokens;

        //if no free mint, pay eth
        if (!hasRole(FREE_MINT_ROLE, msg.sender)) {
            require(msg.value == mintPrice, "Please set the right value");
            //transfer eth to the contract
            _asyncTransfer(address(this), msg.value);
        }
        
        // mint nft
        _safeMint(_recipient, tokenId);
        tokenToBook[tokenId] = _bookId;
        currentSupply++;
        emit MintEvent(_recipient, tokenId, _bookId);
        return tokenId;
    }

    function mintReserve(address _recipient, string memory _bookId) external onlyOwner returns (uint256)
    {
        require(isMintEnabled, "Minting not enabled");
        require(currentSupply <= maxSupply, "Max supply reached");

        // tokenId ++
        reserveTokenId.increment();
        // reserve 100 NFTs from 1 ~ 100 
        uint256 tokenId = reserveTokenId.current();

        require(tokenId <= reserveTokens, "Max reserve reached");
        
        // mint nft
        _safeMint(_recipient, tokenId);
        tokenToBook[tokenId] = _bookId;
        currentSupply++;
        emit MintEvent(_recipient, tokenId, _bookId);
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
        require(_maxSupply > currentSupply, "Must greate than current supply");
        maxSupply = _maxSupply;
    }

    /// @dev Overridden in order to make it an onlyOwner function
    function withdrawPayments(address payable _payee)
        public
        virtual
        override
        onlyOwner
    {
        // 先取
        super.withdrawPayments(payable(address(this)));
        // 再转
        _payee.transfer(address(this).balance);
    }

    receive() external payable {
        //  to receiving ether
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
