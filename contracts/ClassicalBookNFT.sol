// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ClassicalBookNFT is ERC721, PullPayment, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;

    // Constants
    uint256 public maxSupply = 1;

    /// @dev Base token URI used as a prefix by tokenURI().
    string public baseTokenURI;

    event mintEvent(uint256, string, address);

    // name and symbol
    constructor() ERC721("Classical Book NFT Collectioin", "ClassicalBook") {}

    //review by vincent:
    //tokenId可以从0开始，在调用mintTo时通过currentTokenId.current()得到当前可用的id作为本次铸造的tokenId；然后再currentTokenId.increment()进行递增
    //从方法实现上看，铸造NFT没有收费，可以把payable去掉
    /*
        function mintTo(address recipient, string memory bookId)
            public
            returns (uint256)
        {
            uint256 tokenId = currentTokenId.current();
            require(tokenId < maxSupply, "Max supply reached");
            emit mintEvent(tokenId, bookId, recipient);
            _safeMint(recipient, tokenId);
            currentTokenId.increment();
            return tokenId;
        }
    */
    function mintTo(address recipient, string memory bookId)
        public
        payable
        returns (uint256)
    {
        uint256 tokenId = currentTokenId.current();
        require(tokenId < maxSupply, "Max supply reached");

        currentTokenId.increment();
        uint256 newTokenId = currentTokenId.current();
        emit mintEvent(newTokenId, bookId, recipient);
        _safeMint(recipient, newTokenId);
        return newTokenId;
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
    //review by vincent:需要确保 _maxSupply不能小于最新的tokenId
    //uint256 tokenId = currentTokenId.current();
    //require(_maxSupply > tokenId, "Must greate than current token id");
    function setMaxSupply(uint256 _maxSupply) public onlyOwner {
        maxSupply = _maxSupply;
    }

    /**
     * @dev See {IERC721Enumerable-totalSupply}.
     */
    //review by vincent:
    //因为tokenId是从0开始，所以需要return tokenId + 1;
    function totalSupply() public view returns (uint256) {
        uint256 tokenId = currentTokenId.current();
        return tokenId;
    }

    function getMaxSupply() public view returns (uint256) {
        return maxSupply;
    }

    /// @dev Overridden in order to make it an onlyOwner function
    //review by vincent:没有deposit接口，withdraw没有意义？这个接口的设计是什么意思？？
    function withdrawPayments(address payable payee)
        public
        virtual
        override
        onlyOwner
    {
        super.withdrawPayments(payee);
    }
}
